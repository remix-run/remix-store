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
  emittedFiles: ReadonlyMap<string, string>,
  client: Rollup.OutputBundle,
  server: Rollup.OutputBundle,
) {
  let stylesheetAliases = sharedStylesheets(client, server);
  let href = (file: string) => `${base}${file}`;
  let result: AssetsManifest = {
    mode: "build",
    entries: {},
    stylesheets: {},
    importMap: { imports: {} },
  };
  let key = (id: string) => normalizePath(relative(root, id.split("?", 1)[0]!));

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
        styles.add(
          href(bundle === server ? (stylesheetAliases.get(css) ?? css) : css),
        );
      }
      queue.push(...output.imports);
    }
    return { preloads: [...seen].map(href), stylesheets: [...styles] };
  }

  for (let [source, entry] of entries) {
    let output =
      entry.kind === "style"
        ? Object.values(client).find(
            (output) =>
              output.type === "asset" &&
              output.originalFileNames.some(
                (id) => id === source || key(id) === source,
              ),
          )
        : client[emittedFiles.get(source) ?? ""];
    if (entry.kind === "script") {
      if (output?.type !== "chunk")
        throw new Error(`Missing emitted script entry '${source}'.`);
      for (let name of entry.exports ?? []) {
        if (!output.exports.includes(name))
          throw new Error(`'${source}' is missing hydration export '${name}'.`);
      }
      let deps = dependencies(client, [output.fileName]);
      result.entries[source] = {
        kind: "script",
        href: href(output.fileName),
        preloads: deps.preloads,
      };
    } else {
      if (output?.type !== "asset")
        throw new Error(`Missing emitted ${entry.kind} asset '${source}'.`);
      result.entries[source] = {
        kind: entry.kind,
        href: href(output.fileName),
        preloads: [],
      };
      result.stylesheets[source] =
        entry.kind === "style" ? [href(output.fileName)] : [];
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
  return { manifest: result, stylesheetAliases };
}

/** Prefer the client's URL when both builds emit exactly the same CSS bytes. */
function sharedStylesheets(
  client: Rollup.OutputBundle,
  server: Rollup.OutputBundle,
) {
  let clientStyles = new Map<string, string>();
  let aliases = new Map<string, string>();
  for (let output of Object.values(client)) {
    if (output.type === "asset" && output.fileName.endsWith(".css")) {
      clientStyles.set(
        Buffer.from(output.source).toString("base64"),
        output.fileName,
      );
    }
  }
  for (let output of Object.values(server)) {
    if (output.type !== "asset" || !output.fileName.endsWith(".css")) continue;
    let clientFile = clientStyles.get(
      Buffer.from(output.source).toString("base64"),
    );
    if (clientFile) aliases.set(output.fileName, clientFile);
  }
  return aliases;
}
