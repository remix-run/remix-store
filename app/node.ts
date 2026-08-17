import * as path from "node:path";

import { createAssetServer } from "remix/assets";
import { compression } from "remix/middleware/compression";
import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { render } from "./middleware/render.tsx";
import { createApp } from "./router.ts";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const buildId = process.env.ASSET_BUILD_ID;
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

const assetServer = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  fileMap: {
    "/app/*path": "app/*path",
    "/node_modules/*path": "node_modules/*path",
  },

  allowFiles: ["app/**/public/**"],
  allowPackages: ["remix", "@shopify/hydrogen"],
  denyFiles: ["app/**/*.test.*", "app/**/*.spec.*"],
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: isDevelopment
    ? { ignore: ["dist/**", "node_modules/**", "test-results/**"] }
    : false,
  hmr: isHmr
    ? async () =>
        (await import("remix/node-hmr/runtime")).createBrowserHmrChannel()
    : undefined,
  scripts: {
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    },
    loaders: isHmr
      ? [(await import("remix/ui-hmr/assets")).uiHmr()]
      : undefined,
  },
  ...(buildId ? { fingerprint: { buildId } } : {}),
});

const browserEntry = "app/actions/public/entry.tsx";
export const browserEntryHref = await assetServer.getHref(browserEntry);
const browserEntryPreloads = await assetServer.getPreloads(browserEntry);
export const productDetailsEntryHref = await assetServer.getHref(
  "app/assets/public/product-details.tsx",
);
export const snowFieldEntryHref = await assetServer.getHref(
  "app/assets/public/snow-field.tsx",
);

export const app = createApp({
  platform: nodePlatform(),
  renderer: render({
    documentAssets: {
      css: [],
      entry: browserEntryHref,
      js: browserEntryPreloads.map((href) => ({ href })),
    },
    async resolveClientEntry(entryId, component) {
      if (!entryId.startsWith("file://")) {
        throw new Error(
          `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
        );
      }

      let [href, preloads] = await Promise.all([
        assetServer.getHref(entryId),
        assetServer.getPreloads(entryId),
      ]);

      return {
        href,
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
  let servePublicFiles = staticFiles("./public", { index: false });

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

        return (
          (await assetServer.fetch(context.request)) ??
          new Response("Not Found", { status: 404 })
        );
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
