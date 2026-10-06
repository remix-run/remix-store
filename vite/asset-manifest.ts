import { relative } from "node:path";

import { normalizePath, type Rollup } from "vite";

import type { AssetEntry, AssetsManifest } from "../app/asset-resolver.ts";

export type EntryKind = AssetEntry["kind"];
export interface RegisteredEntry {
  kind: EntryKind;
  exports?: string[];
}

/** Compile output facts into the runtime's data-only manifest. */
export function createBuildManifest(
  root: string,
  base: string,
  entries: Map<string, RegisteredEntry>,
  client: Rollup.OutputBundle,
  server: Rollup.OutputBundle,
): AssetsManifest {
  let href = (file: string) => `${base}${file}`;
  let result: AssetsManifest = {
    mode: "build",
    entries: {},
    stylesheets: {},
    importMap: { imports: {} },
  };
  let key = (id: string) => normalizePath(relative(root, id.split("?", 1)[0]!));
  let chunks = Object.values(client).filter(
    (output) => output.type === "chunk",
  );

  function dependencies(bundle: Rollup.OutputBundle, roots: string[]) {
    let seen = new Set<string>();
    let styles = new Set<string>();
    let queue = [...roots];
    for (let index = 0; index < queue.length; index++) {
      let filename = queue[index]!;
      if (bundle === server && filename === "./__remix_asset_manifest.js")
        continue;
      if (seen.has(filename)) continue;
      seen.add(filename);
      let output = bundle[filename];
      if (!output) throw new Error(`Missing asset dependency '${filename}'.`);
      if (output.type !== "chunk") continue;
      for (let css of output.viteMetadata?.importedCss ?? []) {
        if (!bundle[css] && !client[css])
          throw new Error(`Missing stylesheet '${css}'.`);
        styles.add(href(css));
      }
      queue.push(...output.imports);
    }
    return { preloads: [...seen].map(href), stylesheets: [...styles] };
  }

  for (let [source, entry] of entries) {
    if (entry.kind === "script") {
      let chunk = chunks.find(
        (chunk) => chunk.facadeModuleId && key(chunk.facadeModuleId) === source,
      );
      if (!chunk) throw new Error(`Missing emitted script entry '${source}'.`);
      for (let name of entry.exports ?? []) {
        if (!chunk.exports.includes(name))
          throw new Error(`'${source}' is missing hydration export '${name}'.`);
      }
      let deps = dependencies(client, [chunk.fileName]);
      result.entries[source] = {
        kind: "script",
        href: href(chunk.fileName),
        preloads: deps.preloads,
      };
    } else {
      let asset = Object.values(client).find(
        (output) =>
          output.type === "asset" &&
          output.originalFileNames.some(
            (id) => id === source || key(id) === source,
          ),
      );
      if (!asset)
        throw new Error(`Missing emitted ${entry.kind} asset '${source}'.`);
      result.entries[source] = {
        kind: entry.kind,
        href: href(asset.fileName),
        preloads: [],
      };
      result.stylesheets[source] =
        entry.kind === "style" ? [href(asset.fileName)] : [];
    }
  }

  // Modules can belong to several chunks. Union their CSS instead of picking one.
  for (let bundle of [client, server]) {
    for (let output of Object.values(bundle)) {
      if (output.type !== "chunk") continue;
      let { stylesheets } = dependencies(bundle, [output.fileName]);
      for (let id of output.moduleIds) {
        let source = key(id);
        if (source.startsWith("../") || source.startsWith("node_modules/"))
          continue;
        result.stylesheets[source] = [
          ...new Set([...(result.stylesheets[source] ?? []), ...stylesheets]),
        ];
      }
    }
  }
  return result;
}
