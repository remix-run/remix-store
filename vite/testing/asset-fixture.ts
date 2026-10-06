import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { oxygen } from "@shopify/mini-oxygen/vite";
import { remixOxygen } from "../remix-oxygen.ts";

// Read the generated fixture HTML without pinning link attribute order.
export function linkHrefs(html: string, rel: string) {
  return [...html.matchAll(/<link\b([^>]*)>/g)].flatMap(([, attributes]) => {
    let attribute = (name: string) =>
      attributes!.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1];
    let href = attribute("href");
    return attribute("rel") === rel && href ? [href] : [];
  });
}

export async function fixture(overrides: Record<string, string> = {}) {
  await mkdir(resolve(".cache"), { recursive: true });
  let root = await mkdtemp(resolve(".cache/remix-assets-"));
  let resolver = resolve("app/asset-resolver.ts");
  let files: Record<string, string> = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "remix/component",
        target: "ESNext",
      },
    }),
    "app/asset-manifest.ts": 'export default { mode: "unavailable" };',
    "app/public/entry.ts": "export const boot = true;",
    "app/public/dependency.ts": 'export const message = "first render";',
    "app/public/server.css": "body { color: rgb(1, 2, 3); }",
    "app/public/next.css": "body { color: rgb(4, 5, 6); }",
    "app/public/site.css": "button { color: blue; }",
    "app/public/font.woff2": "fixture-font",
    "app/public/lazy.ts": 'export const lazy = "lazy-only";',
    "app/public/counter.tsx": `
      import { clientEntry as island } from "remix/component";
      import { message } from "./dependency.ts";
      export const First = island(import.meta.url, () => () => <p>{message}</p>);
      export const Second = island(import.meta.url, () => () => <p>second island</p>);
      export const loadLazy = () => import("./lazy.ts");
    `,
    "app/server.tsx": `
      import { createRouter } from "remix/router";
      import { render } from "remix/middleware/render";
      import { createAssetResolver } from ${JSON.stringify(resolver)};
      import manifest from "./asset-manifest.ts";
      import "./public/server.css";
      import { First, Second } from "./public/counter.tsx";
      const assets = createAssetResolver(manifest);
      const entry = await assets.getScriptEntry("app/public/entry.ts");
      const css = await assets.getHref("app/public/site.css");
      const font = await assets.getHref("app/public/font.woff2");
      const styles = await assets.getStylesheets("app/server.tsx");
      const router = createRouter({ middleware: [render({ assets })] });
      router.get("/*path", ({ render }) => render(
        <html><head>
          {[css, ...styles].map(href => <link rel="stylesheet" href={href} />)}
          <link rel="preload" as="font" href={font} />
          <script type="module" src={entry.href} />
        </head><body><First /><Second /></body></html>
      ));
      export default router;
      if (import.meta.hot) import.meta.hot.accept();
    `,
  };
  Object.assign(files, overrides);
  for (let [name, source] of Object.entries(files)) {
    let path = resolve(root, name);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, source);
  }
  let plugins = () => [
    oxygen({ entry: "./app/server.tsx", env: {} }),
    remixOxygen({
      serverEntry: "app/server.tsx",
      clientEntry: "app/public/entry.ts",
      compatibilityDate: "2026-04-01",
    }),
  ];
  return {
    root,
    files,
    plugins,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
