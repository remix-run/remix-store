import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import fullstack from "@hiogawa/vite-plugin-fullstack";
import MagicString from "magic-string";
import { parseSync } from "oxc-parser";
import type { Plugin, PluginOption } from "vite";

const CLIENT_ENTRY = "app/entry.browser";
const SERVER_ENTRY = "app/entry.oxygen";
const SERVER_ENVIRONMENT = "ssr";
const WORKER_PATH = "dist/ssr/index.js";
const ASSETS_MANIFEST_PATH = "dist/ssr/__fullstack_assets_manifest.js";
const ASSETS_MANIFEST_IMPORT =
  /import\s+(\w+)\s+from\s*["']\.\/__fullstack_assets_manifest\.js["'];?/;

interface RemixOxygenOptions {
  serverHandler?: boolean;
}

/**
 * The Remix 3 build adapter for this Oxygen-only app.
 *
 * It owns the client/Worker build order, clientEntry() URL transforms, and the
 * final inlining that keeps the deployed Worker self-contained.
 */
export function remixOxygen({
  serverHandler = false,
}: RemixOxygenOptions = {}): PluginOption {
  return [
    fullstack({ serverEnvironments: [SERVER_ENVIRONMENT], serverHandler }),
    build(),
    clientEntryTransform(),
  ];
}

function build(): Plugin {
  return {
    name: "remix-oxygen:build",
    config() {
      return {
        builder: {},
        build: { assetsInlineLimit: 0 },
        environments: {
          client: {
            build: {
              outDir: "dist/client",
              rollupOptions: {
                input: CLIENT_ENTRY,
                output: { minifyInternalExports: false },
              },
            },
          },
          [SERVER_ENVIRONMENT]: {
            build: {
              copyPublicDir: false,
              outDir: "dist/ssr",
              rollupOptions: { input: { index: SERVER_ENTRY } },
            },
          },
        },
      };
    },
    async buildApp(builder) {
      let ssr = builder.environments[SERVER_ENVIRONMENT];
      let client = builder.environments.client;
      if (!ssr || !client)
        throw new Error("Expected Vite client and ssr build environments.");

      // Keep this order: the fullstack manifest connects the server render to
      // the browser assets emitted by the following client build.
      await builder.build(ssr);
      await builder.build(client);

      await builder.writeAssetsManifest();
      finalizeWorker(builder.config.root);
    },
  };
}

function clientEntryTransform(): Plugin {
  return {
    name: "remix-oxygen:client-entry",
    transform: {
      filter: { code: { include: /\bclientEntry\b/ } },
      handler(code, id) {
        if (!code.includes("import.meta.url")) return;

        let program: Program;
        try {
          program = parseSync(id, code).program;
        } catch (error) {
          throw new Error(`Unable to parse clientEntry module: ${id}`, {
            cause: error,
          });
        }

        let calls = findClientEntryCalls(program);
        if (calls.length === 0) return;

        let output = new MagicString(code);
        if (this.environment.name === SERVER_ENVIRONMENT) {
          output.prepend(
            `import ___clientEntryAssets from "${id}?assets=client";\n`,
          );
          for (let call of calls) {
            output.overwrite(
              call.metaUrlStart,
              call.metaUrlEnd,
              `___clientEntryAssets.entry + "#${call.exportName}"`,
            );
          }
        } else {
          for (let call of calls) {
            output.overwrite(
              call.metaUrlStart,
              call.metaUrlEnd,
              `import.meta.url + "#${call.exportName}"`,
            );
          }
        }

        return {
          code: output.toString(),
          map: output.generateMap({ hires: "boundary", source: id }),
        };
      },
    },
  };
}

type Program = ReturnType<typeof parseSync>["program"];

function findClientEntryCalls(program: Program) {
  let calls: Array<{
    exportName: string;
    metaUrlStart: number;
    metaUrlEnd: number;
  }> = [];

  for (let node of program.body) {
    if (node.type !== "ExportNamedDeclaration") continue;
    if (node.declaration?.type !== "VariableDeclaration") continue;

    for (let declarator of node.declaration.declarations) {
      if (declarator.id.type !== "Identifier") continue;
      if (declarator.init?.type !== "CallExpression") continue;
      let call = declarator.init;
      if (
        call.callee.type !== "Identifier" ||
        call.callee.name !== "clientEntry"
      )
        continue;
      if (call.arguments.length < 2) continue;

      let firstArgument = call.arguments[0];
      if (
        firstArgument?.type !== "MemberExpression" ||
        firstArgument.object.type !== "MetaProperty" ||
        firstArgument.property.type !== "Identifier" ||
        firstArgument.property.name !== "url"
      ) {
        continue;
      }

      calls.push({
        exportName: declarator.id.name,
        metaUrlStart: firstArgument.start,
        metaUrlEnd: firstArgument.end,
      });
    }
  }

  return calls;
}

function finalizeWorker(root: string): void {
  let workerPath = resolve(root, WORKER_PATH);
  let manifestPath = resolve(root, ASSETS_MANIFEST_PATH);
  if (!existsSync(workerPath))
    throw new Error(`Missing Oxygen worker: ${WORKER_PATH}`);
  if (!existsSync(manifestPath))
    throw new Error(`Missing asset manifest: ${ASSETS_MANIFEST_PATH}`);

  let worker = readFileSync(workerPath, "utf8");
  let match = worker.match(ASSETS_MANIFEST_IMPORT);
  if (!match)
    throw new Error(`Missing asset manifest import in ${WORKER_PATH}`);

  let manifest = readFileSync(manifestPath, "utf8")
    .trim()
    .replace(/^export\s+default\s*/, "")
    .replace(/;$/, "");
  let parsedAssets: unknown;
  try {
    parsedAssets = JSON.parse(manifest);
  } catch (error) {
    throw new Error(`Invalid JSON in ${ASSETS_MANIFEST_PATH}`, {
      cause: error,
    });
  }
  if (
    !parsedAssets ||
    typeof parsedAssets !== "object" ||
    Array.isArray(parsedAssets)
  ) {
    throw new Error(
      `Invalid asset manifest structure in ${ASSETS_MANIFEST_PATH}`,
    );
  }
  let assets = parsedAssets as {
    client?: Record<string, { entry?: string }>;
    [environment: string]: unknown;
  };
  if (
    !assets.client ||
    typeof assets.client !== "object" ||
    Array.isArray(assets.client)
  ) {
    throw new Error(`Missing client assets in ${ASSETS_MANIFEST_PATH}`);
  }

  validateHydrationEntries(root, assets.client);
  writeFileSync(
    workerPath,
    worker.replace(
      ASSETS_MANIFEST_IMPORT,
      `const ${match[1]} = ${JSON.stringify(assets)};`,
    ),
  );
  rmSync(manifestPath);
}

function validateHydrationEntries(
  root: string,
  clientAssets: Record<string, { entry?: string }>,
): void {
  for (let [sourcePath, assets] of Object.entries(clientAssets)) {
    let sourceFile = resolve(root, sourcePath);
    if (!existsSync(sourceFile) || !assets.entry) continue;

    let source = readFileSync(sourceFile, "utf8");
    let expectedExports = [
      ...source.matchAll(/export\s+const\s+(\w+)\s*=\s*clientEntry\s*\(/g),
    ].map((match) => match[1]);
    if (expectedExports.length === 0) continue;

    let entryPath = resolve(root, `dist/client${assets.entry}`);
    let entry = readFileSync(entryPath, "utf8");
    let actualExports = new Set(
      [...entry.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((match) =>
        match[1].split(",").map((value) =>
          value
            .trim()
            .split(/\s+as\s+/)
            .at(-1),
        ),
      ),
    );
    let missing = expectedExports.filter((name) => !actualExports.has(name));
    if (missing.length > 0) {
      throw new Error(
        `${entryPath} is missing hydration exports: ${missing.join(", ")}`,
      );
    }
  }
}
