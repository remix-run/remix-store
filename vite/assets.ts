import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  normalizePath,
  parseSync,
  type DevEnvironment,
  type EnvironmentModuleNode,
  type ESTree,
  type Plugin,
  type ResolvedConfig,
  type Rollup,
  type ViteDevServer,
} from "vite";

import type { AssetsManifest } from "../app/asset-resolver.ts";
import { createBrowserAccess } from "./browser-access.ts";
import {
  createBuildManifest,
  type EntryKind,
  type RegisteredEntry,
} from "./asset-manifest.ts";

const MANIFEST_IMPORT = "./__remix_asset_manifest.js";

export interface AssetsOptions {
  serverEntry: string;
  manifestModule?: string;
  include?: string[];
}

export function createAssetsPlugin(options: AssetsOptions) {
  let root: string;
  let base: string;
  let manifestId: string;
  let server: ViteDevServer;
  let entries = new Map<string, RegisteredEntry>();
  let references = new Map<string, Map<string, RegisteredEntry>>();
  let clientBundle: Rollup.OutputBundle;
  let serverBundle: Rollup.OutputBundle;
  let inspected = new Set<string>();
  let access: ReturnType<typeof createBrowserAccess>;

  function initializeCSS(config: ResolvedConfig) {
    let postcss = config.css.postcss;
    if (typeof postcss !== "object") return;
    for (let plugin of postcss.plugins ?? []) {
      if (
        plugin &&
        typeof plugin === "object" &&
        "postcssPlugin" in plugin &&
        plugin.postcssPlugin === "remix:browser-access"
      )
        plugin.Once = (styles) => access.css.Once(styles);
    }
  }

  function kind(key: string): EntryKind {
    return /\.[cm]?[jt]sx?$/.test(key)
      ? "script"
      : key.endsWith(".css")
        ? "style"
        : "file";
  }
  function register(key: string, entry: RegisteredEntry) {
    if (
      key.startsWith("/") ||
      key.split("/").some((part) => part === ".." || part === ".")
    )
      throw new Error(`Asset entry '${key}' must be root-relative.`);
    if (
      !key.startsWith("app/") ||
      !key.includes("/public/") ||
      /\.(test|spec)\./.test(key)
    )
      throw new Error(
        `Asset entry '${key}' must live under app/**/public/ and must not be a test file.`,
      );
    let previous = entries.get(key);
    entries.set(key, {
      ...entry,
      exports: [
        ...new Set([...(previous?.exports ?? []), ...(entry.exports ?? [])]),
      ],
    });
  }
  function registerScript(key: string, exports: string[]) {
    let source = resolve(root, key);
    let own = references.get(source) ?? new Map<string, RegisteredEntry>();
    own.set(key, { kind: "script", exports });
    references.set(source, own);
    register(key, { kind: "script", exports });
  }

  async function inspectGraph(environment: DevEnvironment, roots: string[]) {
    let visited = new Set<string>();
    let modules = new Map<string, EnvironmentModuleNode>();
    let staticImports = new Map<string, string[]>();
    async function visit(id: string) {
      if (visited.has(id) || id === manifestId || id.startsWith("\0")) return;
      visited.add(id);
      // Transform only; executing the entry here would recurse through the manifest.
      let transformed = await environment.transformRequest(id);
      let dependencies: string[] = [];
      let sources = transformed?.deps;
      if (!sources && transformed) {
        let parsed = parseSync(id, transformed.code);
        sources = parsed.program.body.flatMap((node) =>
          (node.type === "ImportDeclaration" ||
            node.type === "ExportNamedDeclaration" ||
            node.type === "ExportAllDeclaration") &&
          node.source
            ? [node.source.value]
            : [],
        );
      }
      for (let dependency of sources ?? []) {
        let resolved = await environment.pluginContainer.resolveId(
          dependency,
          id,
        );
        if (resolved && !resolved.external) dependencies.push(resolved.id);
      }
      staticImports.set(id, dependencies);
      let module = environment.moduleGraph.getModuleById(id);
      if (!module) return;
      modules.set(id, module);
      for (let imported of module.importedModules) {
        if (imported.id) await visit(imported.id);
      }
    }
    for (let id of roots) await visit(id);
    return { visited, modules, staticImports };
  }

  async function developmentManifest(
    environment: DevEnvironment,
  ): Promise<AssetsManifest> {
    let graph = await inspectGraph(environment, [
      resolve(root, options.serverEntry),
    ]);
    let { visited } = graph;
    entries = new Map();
    for (let key of options.include ?? []) register(key, { kind: kind(key) });
    for (let id of visited) {
      for (let [key, entry] of references.get(id) ?? []) register(key, entry);
    }
    let manifest: AssetsManifest = {
      mode: "dev",
      entries: {},
      stylesheets: {},
      importMap: { imports: {} },
    };
    for (let [key, entry] of entries) {
      let timestamp = server.environments.client?.moduleGraph.getModuleById(
        resolve(root, key),
      )?.lastHMRTimestamp;
      manifest.entries[key] = {
        kind: entry.kind,
        href: `${base}${key}${entry.kind === "script" && timestamp ? `?t=${timestamp}` : ""}`,
        preloads: [],
      };
      manifest.stylesheets[key] =
        entry.kind === "style" ? [`${base}${key}`] : [];
    }
    // Literal references and explicit include roots are not necessarily SSR
    // imports. Inspect their browser graph too so extracted CSS is complete.
    let browserGraph = await inspectGraph(
      server.environments.client!,
      [...entries]
        .filter(([, entry]) => entry.kind !== "file")
        .map(([key]) => resolve(root, key)),
    );
    inspected = new Set([...visited, ...browserGraph.visited]);
    for (let { modules, staticImports } of [graph, browserGraph])
      for (let [id, module] of modules) {
        let seen = new Set<string>();
        let css = new Set<string>();
        function collect(mod: EnvironmentModuleNode) {
          if (!mod.id || seen.has(mod.id)) return;
          seen.add(mod.id);
          if (mod.id.endsWith(".css")) {
            css.add(`${base}${normalizePath(relative(root, mod.id))}`);
            return;
          }
          // importedModules also contains dynamic edges; only follow static ones.
          for (let id of staticImports.get(mod.id) ?? []) {
            let imported = modules.get(id);
            if (imported) collect(imported);
          }
        }
        collect(module);
        let key = normalizePath(relative(root, id));
        if (key.startsWith("../") || key.startsWith("node_modules/")) continue;
        manifest.stylesheets[key] = [
          ...new Set([...(manifest.stylesheets[key] ?? []), ...css]),
        ];
      }
    return manifest;
  }

  const plugin: Plugin = {
    name: "remix:assets",
    enforce: "pre",
    sharedDuringBuild: true,
    config(userConfig) {
      if (typeof userConfig.css?.postcss === "string")
        throw new Error(
          "The browser access guard requires inline PostCSS configuration.",
        );
      return {
        css: {
          postcss: {
            plugins: [
              {
                postcssPlugin: "remix:browser-access",
                Once() {
                  throw new Error(
                    "Browser CSS access guard has not been initialized.",
                  );
                },
              },
            ],
          },
        },
        appType: "custom",
        environments: {
          // Discovery must not refill MiniOxygen's invalidated SSR cache before
          // its non-HMR module runner observes source changes on the next request.
          assets: {
            consumer: "server",
            resolve: { noExternal: true },
            optimizeDeps: { noDiscovery: true },
          },
          client: {
            optimizeDeps: {
              noDiscovery: true,
              include: ["@shopify/hydrogen"],
              exclude: ["remix"],
            },
          },
          ssr: { build: { emitAssets: true } },
        },
      };
    },
    configResolved(config) {
      root = config.root;
      base = config.base;
      // Mirror SSR semantics without sharing caches or MiniOxygen's factory.
      let ssr = config.environments.ssr!;
      let discovery = config.environments.assets!;
      discovery.resolve = { ...ssr.resolve };
      discovery.define = { ...ssr.define };
      discovery.optimizeDeps = { ...ssr.optimizeDeps, noDiscovery: true };
      access = createBrowserAccess(config);
      initializeCSS(config);
      if (
        config.css.transformer === "lightningcss" ||
        typeof config.css.postcss === "string"
      )
        throw new Error(
          "The browser access guard requires inline PostCSS configuration.",
        );
      if (!config.environments.client!.optimizeDeps.noDiscovery)
        throw new Error(
          "Browser dependency discovery must remain disabled so only approved optimizer roots are served.",
        );
      for (let entry of config.environments.client!.optimizeDeps.include ??
        []) {
        if (
          entry !== "@shopify/hydrogen" &&
          entry !== "remix" &&
          !entry.startsWith("remix/")
        )
          throw new Error(`Unapproved browser optimizer root '${entry}'.`);
      }
      if (!base.startsWith("/") && !/^https?:\/\//.test(base))
        throw new Error(
          "The local asset adapter requires a root-relative or absolute CDN base.",
        );
      if (config.environments.client?.build.chunkImportMap)
        throw new Error(
          "Chunk import maps are not supported by the local asset adapter.",
        );
      if (config.experimental.renderBuiltUrl)
        throw new Error(
          "renderBuiltUrl is not supported by the local asset adapter; configure base instead.",
        );
      manifestId = normalizePath(
        resolve(root, options.manifestModule ?? "app/asset-manifest.ts"),
      );
      for (let key of options.include ?? []) register(key, { kind: kind(key) });
    },
    configureServer(instance) {
      server = instance;
      // Raw/static URL requests bypass module hooks in development too.
      server.middlewares.use((request, response, next) => {
        try {
          access.assertRequest(request.url ?? "/");
        } catch {
          response.statusCode = 404;
          response.setHeader("Cache-Control", "no-store");
          response.end("Not Found");
          return;
        }
        next();
      });
    },
    async resolveId(source, importer) {
      if (source === MANIFEST_IMPORT)
        return { id: MANIFEST_IMPORT, external: true };
      if (
        source === manifestId ||
        (importer &&
          normalizePath(resolve(importer.split("?", 1)[0]!, "..", source)) ===
            manifestId)
      ) {
        if (this.environment.name === "client")
          throw new Error(
            "The server asset manifest must not be imported by browser code.",
          );
        return this.environment.mode === "build"
          ? { id: MANIFEST_IMPORT, external: true }
          : manifestId;
      }
    },
    async load(id) {
      if (this.environment.config.consumer === "client")
        access.assertFile(id, this.environment.mode === "dev");
      if (id === manifestId) {
        let manifest = await developmentManifest(server.environments.assets!);
        return `export default ${JSON.stringify(manifest)};`;
      }
    },
    transform(code, id) {
      if (this.environment.config.consumer === "client") {
        access.assertFile(id, this.environment.mode === "dev");
        return;
      }
      if (!id.startsWith(root + "/") || !/\.[cm]?[jt]sx?$/.test(id)) return;
      let own = new Map<string, RegisteredEntry>();
      if (/\bget(?:ScriptEntry|Href)\b/.test(code)) {
        let parsed = parseSync(id, code);
        if (parsed.errors.length)
          throw new Error(`Cannot analyze asset references in '${id}'.`);
        function walk(node: ESTree.Node) {
          if (
            node.type === "CallExpression" &&
            node.callee.type === "MemberExpression" &&
            node.callee.property.type === "Identifier" &&
            ["getScriptEntry", "getHref"].includes(node.callee.property.name)
          ) {
            let argument = node.arguments[0];
            if (
              argument?.type === "Literal" &&
              typeof argument.value === "string"
            ) {
              let key = argument.value.replace(/^file:/, "").split("#", 1)[0]!;
              let entry: RegisteredEntry = {
                kind:
                  node.callee.property.name === "getScriptEntry"
                    ? "script"
                    : kind(key),
              };
              own.set(key, entry);
              register(key, entry);
            }
          }
          for (let value of Object.values(node)) {
            if (Array.isArray(value)) {
              for (let item of value)
                if (item && typeof item === "object" && "type" in item)
                  walk(item as ESTree.Node);
            } else if (value && typeof value === "object" && "type" in value)
              walk(value as ESTree.Node);
          }
        }
        walk(parsed.program);
      }
      references.set(id, own);
    },
    async buildStart() {
      // Config-file builds reload configuration for each environment, while this
      // plugin is shared. Bind fresh CSS guards to the shared access policy.
      initializeCSS(this.environment.getTopLevelConfig());
      if (this.environment.name !== "client") return;
      for (let [key, entry] of entries) {
        let id = resolve(root, key);
        if (entry.kind === "file") {
          this.emitFile({
            type: "asset",
            name: key.split("/").at(-1),
            originalFileName: id,
            source: await readFile(id),
          });
        } else {
          this.emitFile({
            type: "chunk",
            id,
            preserveSignature: "exports-only",
          });
        }
      }
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        // MiniOxygen can emit server metadata during the client build too. It is
        // reserved Worker output, never part of the public browser directory.
        if (this.environment.name === "client") delete bundle["oxygen.json"];
        // Asset URL readers can bypass module hooks. Check their provenance
        // again before any output is written; CSS sources are checked by PostCSS.
        for (let output of Object.values(bundle)) {
          if (
            output.type !== "asset" ||
            output.fileName.endsWith(".map") ||
            output.fileName === "oxygen.json" ||
            output.fileName.endsWith(".css")
          )
            continue;
          for (let file of output.originalFileNames)
            access.assertFile(resolve(root, file));
        }
        if (this.environment.name === "client") clientBundle = bundle;
        if (this.environment.name === "ssr") serverBundle = bundle;
      },
    },
    hotUpdate({ file, modules, timestamp }) {
      if (this.environment.name !== "ssr" || !inspected.has(file)) return;
      let manifest = this.environment.moduleGraph.getModuleById(manifestId);
      if (manifest)
        this.environment.moduleGraph.invalidateModule(
          manifest,
          new Set(),
          timestamp,
          true,
        );
      server.environments.client?.hot.send({ type: "full-reload" });
      return manifest ? [...modules, manifest] : modules;
    },
  };

  return {
    plugin,
    registerScript,
    manifest() {
      return createBuildManifest(
        root,
        base,
        entries,
        clientBundle,
        serverBundle,
      );
    },
    serverOutput() {
      return serverBundle;
    },
  };
}
