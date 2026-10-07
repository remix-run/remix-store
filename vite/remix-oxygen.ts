import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { build, type Plugin, type PluginOption } from "vite";

import { createAssetsPlugin } from "./assets.ts";
import { clientEntries } from "./client-entry.ts";

interface RemixOxygenOptions {
  compatibilityDate?: string;
  serverEntry?: string;
  clientEntry?: string;
  manifestModule?: string;
  include?: string[];
}

/** Local Remix asset integration; MiniOxygen remains the Worker runtime adapter. */
export function remixOxygen({
  compatibilityDate,
  serverEntry = "app/entry.oxygen.ts",
  clientEntry = "app/actions/public/entry.tsx",
  manifestModule,
  include,
}: RemixOxygenOptions = {}): PluginOption {
  let assets = createAssetsPlugin({ serverEntry, manifestModule, include });
  const buildPlugin: Plugin = {
    name: "remix-oxygen:build",
    config() {
      return {
        builder: {},
        build: { assetsInlineLimit: 0 },
        environments: {
          client: {
            build: {
              outDir: "dist/client",
              rolldownOptions: { input: clientEntry },
            },
          },
          ssr: {
            optimizeDeps: { include: ["sanitize-html"] },
            build: {
              write: false,
              copyPublicDir: false,
              outDir: "dist/server",
              rolldownOptions: {
                input: { index: serverEntry },
                output: { codeSplitting: false },
              },
            },
          },
        },
      };
    },
    async buildApp(builder) {
      let ssr = builder.environments.ssr;
      let client = builder.environments.client;
      if (!ssr || !client)
        throw new Error("Expected client and ssr build environments.");
      // Discover browser roots without evaluating application code or writing
      // an incomplete Worker. Client emission completes the manifest.
      await builder.build(ssr);
      await builder.build(client);
      let manifest = assets.manifest();
      let serverOutput = assets.serverOutput();
      let worker = Object.values(serverOutput).find(
        (output) => output.type === "chunk" && output.isEntry,
      );
      if (!worker || worker.type !== "chunk")
        throw new Error("Missing Oxygen Worker output.");
      let manifestImport = "./__remix_asset_manifest.js";
      if (worker.imports.some((id) => id !== manifestImport))
        throw new Error(
          "The Oxygen discovery build contains unexpected external imports.",
        );

      let compiledEntry = resolve(
        builder.config.root,
        ssr.config.build.outDir,
        "__worker_entry.js",
      );
      let compiledManifest = resolve(
        builder.config.root,
        ssr.config.build.outDir,
        "__remix_asset_manifest.js",
      );
      // A real bundler pass, not text substitution, makes the completed manifest
      // and compiled server code one deployable module.
      await build({
        configFile: false,
        root: builder.config.root,
        logLevel: builder.config.logLevel,
        ssr: { noExternal: true, target: "webworker" },
        build: {
          ssr: true,
          outDir: ssr.config.build.outDir,
          emptyOutDir: true,
          copyPublicDir: false,
          target: "esnext",
          minify: ssr.config.build.minify,
          sourcemap: ssr.config.build.sourcemap,
          rolldownOptions: {
            input: "virtual:oxygen-worker",
            output: { entryFileNames: "index.js", codeSplitting: false },
          },
        },
        plugins: [
          {
            name: "remix-oxygen:finalize",
            resolveId(id) {
              // Non-virtual synthetic filenames let Rolldown retain the
              // discovery sourcemap through finalization (no files are written).
              if (id === "virtual:oxygen-worker") return compiledEntry;
              if (id === manifestImport) return compiledManifest;
            },
            load(id) {
              if (id === compiledEntry)
                return { code: worker.code, map: worker.map };
              if (id === compiledManifest)
                return `export default ${JSON.stringify(manifest)};`;
            },
          },
        ],
      });
      // Only browser-referenced resources are public, never server sidecars.
      let browserFiles = new Set<string>();
      for (let output of Object.values(serverOutput)) {
        if (output.type !== "chunk") continue;
        for (let file of output.viteMetadata?.importedCss ?? [])
          browserFiles.add(file);
        for (let file of output.viteMetadata?.importedAssets ?? [])
          browserFiles.add(file);
      }
      for (let output of Object.values(serverOutput)) {
        if (
          output.type !== "asset" ||
          !browserFiles.has(output.fileName) ||
          output.fileName.endsWith(".map") ||
          output.fileName === "oxygen.json"
        )
          continue;
        let path = resolve(
          builder.config.root,
          client.config.build.outDir,
          output.fileName,
        );
        await mkdir(resolve(path, ".."), { recursive: true });
        await writeFile(path, output.source);
      }
      if (compatibilityDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate))
          throw new Error(
            `Invalid Oxygen compatibility date: ${compatibilityDate}`,
          );
        await writeFile(
          resolve(builder.config.root, ssr.config.build.outDir, "oxygen.json"),
          JSON.stringify(
            { version: 1, compatibility_date: compatibilityDate },
            null,
            2,
          ),
        );
      }
    },
  };
  return [assets.plugin, clientEntries(assets.registerScript), buildPlugin];
}
