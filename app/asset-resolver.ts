import type { ScriptEntry } from "remix/assets";

import type { Assets } from "./assets.ts";

export interface AssetEntry {
  kind: "script" | "style" | "file";
  href: string;
  preloads: string[];
}

export type AssetsManifest =
  | { mode: "unavailable" }
  | {
      mode: "dev" | "build";
      entries: Record<string, AssetEntry>;
      stylesheets: Record<string, string[]>;
      importMap: ScriptEntry["importMap"];
    };

/** Pure data in, browser metadata out. Safe to construct inside a Worker. */
export function createAssetResolver(manifest: AssetsManifest): Assets & {
  getPreloads(paths: string | string[]): Promise<string[]>;
  getImportMap(paths: string | string[]): Promise<ScriptEntry["importMap"]>;
  getStylesheets(paths: string | string[]): Promise<string[]>;
} {
  function available() {
    if (manifest.mode === "unavailable") {
      throw new Error(
        "Asset manifest unavailable. Run through the local Remix Vite plugin, or supply a generated manifest to createAssetResolver().",
      );
    }
    return manifest;
  }

  function sourceKey(path: string) {
    let key = path
      .split("#", 1)[0]!
      .replace(/^file:/, "")
      .replaceAll("\\", "/");
    if (
      !key ||
      key.startsWith("/") ||
      key.split("/").some((part) => part === ".." || part === ".")
    ) {
      throw new Error(
        `Expected a root-relative asset source key, received '${path}'.`,
      );
    }
    return key;
  }

  function entry(path: string, method: string): AssetEntry {
    let key = sourceKey(path);
    let entries = available().entries;
    let value = Object.hasOwn(entries, key) ? entries[key] : undefined;
    if (!value) {
      throw new Error(
        `${method}: no browser output registered for '${key}'. Use a literal getScriptEntry()/getHref() call or the Vite plugin's include option.`,
      );
    }
    return value;
  }

  function pathsArray(paths: string | string[]) {
    return typeof paths === "string" ? [paths] : paths;
  }

  return {
    async getScriptEntry(path): Promise<ScriptEntry> {
      let value = entry(path, "getScriptEntry");
      if (value.kind !== "script") {
        throw new Error(`getScriptEntry: '${path}' is not a script entry.`);
      }
      return {
        href: value.href,
        preloads: [...value.preloads],
        importMap: available().importMap,
      };
    },
    async getHref(path) {
      return entry(path, "getHref").href;
    },
    async getPreloads(paths) {
      available();
      return [
        ...new Set(
          pathsArray(paths).flatMap((path) => {
            let value = entry(path, "getPreloads");
            return value.kind === "script" ? value.preloads : [value.href];
          }),
        ),
      ];
    },
    async getImportMap(paths) {
      let data = available();
      for (let path of pathsArray(paths)) entry(path, "getImportMap");
      return pathsArray(paths).length ? data.importMap : { imports: {} };
    },
    async getStylesheets(paths) {
      let data = available();
      return [
        ...new Set(
          pathsArray(paths).flatMap((path) => {
            let key = sourceKey(path);
            let value = Object.hasOwn(data.stylesheets, key)
              ? data.stylesheets[key]
              : undefined;
            if (!value) {
              throw new Error(
                `getStylesheets: unknown source module '${key}'.`,
              );
            }
            return value;
          }),
        ),
      ];
    },
  };
}
