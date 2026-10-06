import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import valueParser from "postcss-value-parser";
import { normalizePath, type ResolvedConfig } from "vite";

// Match the native Node adapter: application sources are public by placement;
// only these packages and their installed dependencies may reach the browser.
const browserPackages = ["remix", "@shopify/hydrogen"];
const isWithin = (directory: string, file: string) => {
  let key = relative(directory, file);
  return key === "" || (!key.startsWith("..") && !isAbsolute(key));
};
const clean = (id: string) => id.split(/[?#]/, 1)[0]!;

interface CSSNode {
  type: string;
  value?: string;
  params?: string;
  source?: { input: { file?: string } };
}

export function createBrowserAccess(config: ResolvedConfig) {
  let root = realpathSync(config.root);
  let publicDir = config.publicDir && realpathSyncIfExists(config.publicDir);
  let packages = new Set<string>();
  function allowPackage(name: string, importer: string) {
    let require = createRequire(importer);
    for (let directory of require.resolve.paths(name) ?? []) {
      let candidate = resolve(directory, name);
      if (!existsSync(resolve(candidate, "package.json"))) continue;
      let path = realpathSync(candidate);
      if (packages.has(path)) return;
      packages.add(path);
      let pkg = JSON.parse(readFileSync(resolve(path, "package.json"), "utf8"));
      for (let dependency of Object.keys({
        ...pkg.dependencies,
        ...pkg.optionalDependencies,
      }))
        allowPackage(dependency, resolve(path, "package.json"));
      return;
    }
  }
  for (let name of browserPackages)
    allowPackage(name, resolve(root, "package.json"));
  let viteClient = resolve(
    dirname(createRequire(import.meta.url).resolve("vite/package.json")),
    "dist/client",
  );
  let clientCache = resolve(config.cacheDir, "deps");

  function assertFile(id: string, development = false) {
    if (id.startsWith("\0") || !isAbsolute(id)) return;
    let file = realpathSyncIfExists(clean(id));
    if (!file) return;
    if (
      development &&
      (isWithin(viteClient, file) || isWithin(clientCache, file))
    )
      return;
    if (publicDir && isWithin(publicDir, file)) return;
    if ([...packages].some((directory) => isWithin(directory, file))) return;
    let key = normalizePath(relative(root, file));
    if (
      key.startsWith("app/") &&
      key.includes("/public/") &&
      !/\.(test|spec)\./.test(key)
    )
      return;
    throw new Error(
      `Server-only file '${key}' entered the browser graph. Browser files must live under app/**/public/ or public/, or belong to an allowed package.`,
    );
  }

  // Vite reads CSS url() assets without running module transform hooks. Check
  // URLs before Vite rewrites/inlines them, including imported CSS and image-set.
  let resolveURL = config.createResolver({
    preferRelative: true,
    extensions: [],
    tryIndex: false,
    mainFields: [],
  });
  async function checkURL(value: string, importer: string) {
    let url = decodeCSS(value.trim());
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return;
    url = decodeURI(url);
    let file =
      url.startsWith("/") && publicDir
        ? resolve(publicDir, clean(url).slice(1))
        : undefined;
    if (file && existsSync(file)) {
      assertFile(file);
      return;
    }
    let resolved = await resolveURL(url, importer);
    if (resolved) assertFile(resolved);
  }
  let css = {
    postcssPlugin: "remix:browser-access",
    async Once(styles: { walk(callback: (node: CSSNode) => void): void }) {
      let checks: Promise<void>[] = [];
      styles.walk((node) => {
        let importer = node.source?.input.file;
        if (!importer) return;
        assertFile(importer);
        let value = node.type === "decl" ? node.value : node.params;
        if (!value) return;
        valueParser(value).walk((part) => {
          if (part.type !== "function") return;
          if (part.value.toLowerCase() === "url") {
            let contents = part.nodes.filter(
              (node) => node.type !== "space" && node.type !== "comment",
            );
            let url =
              contents.length === 1 && contents[0]!.type === "string"
                ? contents[0]!.value
                : valueParser.stringify(contents);
            checks.push(checkURL(url, importer));
            return false;
          }
          if (/^(?:-webkit-)?image-set$/i.test(part.value)) {
            for (let node of part.nodes)
              if (node.type === "string")
                checks.push(checkURL(node.value, importer));
          }
        });
      });
      await Promise.all(checks);
    },
  };
  function assertRequest(url: string) {
    let pathname = decodeURIComponent(clean(url));
    if (config.base !== "/" && pathname.startsWith(config.base))
      pathname = pathname.slice(config.base.length - 1);
    let candidates = pathname.startsWith("/@fs/")
      ? [pathname.slice(4)]
      : [
          publicDir && resolve(publicDir, pathname.slice(1)),
          resolve(root, pathname.slice(1)),
        ];
    for (let candidate of candidates) {
      if (!candidate || !existsSync(candidate)) continue;
      if (statSync(candidate).isDirectory())
        candidate = resolve(candidate, "index.html");
      if (!existsSync(candidate)) continue;
      assertFile(candidate, true);
      // Public static files take precedence over identically named root files.
      return;
    }
  }
  return { assertFile, assertRequest, css };
}

function realpathSyncIfExists(file: string) {
  return existsSync(file) ? realpathSync(file) : undefined;
}

function decodeCSS(value: string) {
  return value.replace(
    /\\(?:([\da-f]{1,6})\s?|([\s\S]))/gi,
    (_match, hex: string | undefined, char: string) => {
      if (!hex) return /[\n\r\f]/.test(char) ? "" : char;
      let code = parseInt(hex, 16);
      return String.fromCodePoint(
        code === 0 || code > 0x10ffff ? 0xfffd : code,
      );
    },
  );
}
