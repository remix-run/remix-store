import * as path from "node:path";

import { createAssetServer } from "remix/assets";
import { compression } from "remix/middleware/compression";
import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { render } from "./middleware/render.tsx";
import type { DocumentFonts } from "./ui/document-assets.tsx";
import { createApp } from "./router.ts";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const buildId = process.env.ASSET_BUILD_ID;
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

const assetServerOptions: Parameters<typeof createAssetServer>[0] = {
  basePath: "/assets",
  rootDir: process.cwd(),
  mounts: {
    app: "app",
    node_modules: "node_modules",
  },
  allowFiles: ["app/**/public/**"],
  allowPackages: ["remix", "@shopify/hydrogen"],
  denyFiles: ["app/**/*.test.*", "app/**/*.spec.*"],
  files: { extensions: [".woff2"] },
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: isDevelopment
    ? { ignore: ["dist/**", "node_modules/**", "test-results/**"] }
    : false,
  hmr: isHmr
    ? {
        channel: async () =>
          (await import("remix/node-hmr/runtime")).createBrowserHmrChannel(),
        moduleImporter: "remix/multiple-import-maps-polyfill",
      }
    : undefined,
  scripts: {
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    },
    loaders: isHmr
      ? [(await import("remix/ui-hmr/assets")).uiHmr()]
      : undefined,
  },
};
if (buildId) assetServerOptions.fingerprint = true;

const assetServer = createAssetServer(assetServerOptions);

const browserEntry = "app/actions/public/entry.tsx";
const browserScriptEntry = await assetServer.getScriptEntry(browserEntry);
export const browserEntryHref = browserScriptEntry.href;
export const productDetailsEntryHref = await assetServer.getHref(
  "app/assets/public/product-details.tsx",
);
const preflightHref = await assetServer.getHref(
  "app/assets/public/preflight.css",
);
const fontDir = "app/assets/public/font";
export const fonts: DocumentFonts = {
  interItalic: await assetServer.getHref(
    `${fontDir}/inter-italic-latin-var.woff2`,
  ),
  interRoman: await assetServer.getHref(
    `${fontDir}/inter-roman-latin-var.woff2`,
  ),
  jetBrainsMono: await assetServer.getHref(`${fontDir}/jet-brains-mono.woff2`),
  lexendZetta: await assetServer.getHref(`${fontDir}/lexend-zetta-black.woff2`),
};
export const snowFieldEntryHref = await assetServer.getHref(
  "app/assets/public/snow-field.tsx",
);

export const app = createApp({
  platform: nodePlatform(),
  renderer: render({
    documentAssets: {
      css: [{ href: preflightHref }],
      entry: browserScriptEntry.href,
      fonts,
      importMap: browserScriptEntry.importMap,
      js: browserScriptEntry.preloads.map((href) => ({ href })),
    },
    async resolveClientEntry(entryId, component) {
      if (!entryId.startsWith("file://")) {
        throw new Error(
          `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
        );
      }

      let { href, importMap, preloads } =
        await assetServer.getScriptEntry(entryId);

      return {
        href,
        importMap,
        exportName:
          entryId.split("#")[1] || component.name || titleCaseFileName(entryId),
        preloads,
      };
    },
  }),
});

export function closeNodeApp() {
  return assetServer.close();
}

function nodePlatform(): Middleware {
  let compress = compression();
  // Root public files keep stable, unfingerprinted URLs, so cache them briefly.
  // Fingerprinted `/assets/*` responses set their own immutable headers.
  let servePublicFiles = staticFiles("./public", {
    cacheControl: "public, max-age=86400",
    index: false,
  });

  return (context, next) => {
    if (context.url.pathname === "/health") {
      return new Response("OK", {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return compress(context, async () =>
      servePublicFiles(context, async () => {
        let { pathname } = context.url;
        if (pathname !== "/assets" && !pathname.startsWith("/assets/")) {
          return next();
        }

        let response = await assetServer.fetch(context.request);
        if (response && response.status < 400) return response;

        // A stale fingerprint during a deploy must not be cached by a CDN.
        let headers = new Headers(response?.headers);
        headers.set("Cache-Control", "no-store");
        return new Response(response ? response.body : "Not Found", {
          headers,
          status: response?.status ?? 404,
        });
      }),
    );
  };
}

function titleCaseFileName(fileUrl: string): string {
  let url = new URL(fileUrl);
  let fileName = path.basename(url.pathname, path.extname(url.pathname));
  return fileName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join("");
}
