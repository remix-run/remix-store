import * as path from "node:path";

import { createAssetServer } from "remix/assets";
import { staticFiles } from "remix/middleware/static";
import type { Middleware } from "remix/router";

import { render } from "./middleware/render.tsx";
import { createApp } from "./router.ts";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const buildId = process.env.ASSET_BUILD_ID;

const assetServer = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  fileMap: {
    "app/*path": "app/*path",
    "node_modules/*path": "node_modules/*path",
  },
  allow: ["app/assets/**", "app/entry.browser.ts", "node_modules/**"],
  deny: ["app/**/*.server.*", "app/**/*.test.*", "app/**/*.spec.*"],
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: isDevelopment ? { ignore: ["**/node_modules/**"] } : false,
  ...(buildId ? { fingerprint: { buildId } } : {}),
});

export const browserEntryHref = await assetServer.getHref(
  "app/entry.browser.ts",
);

export const app = createApp({
  platform: nodePlatform(),
  renderer: render({
    documentAssets: {
      css: [],
      entry: browserEntryHref,
      js: [],
    },
    async resolveClientEntry(entryId, component) {
      if (!entryId.startsWith("file://")) {
        throw new Error(
          `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
        );
      }

      return {
        href: await assetServer.getHref(entryId),
        exportName:
          entryId.split("#")[1] || component.name || titleCaseFileName(entryId),
      };
    },
  }),
});

export function closeNodeApp() {
  return assetServer.close();
}

function nodePlatform(): Middleware {
  let servePublicFiles = staticFiles("./public", { index: false });

  return (context, next) =>
    servePublicFiles(context, async () => {
      let { pathname } = context.url;
      if (pathname !== "/assets" && !pathname.startsWith("/assets/")) {
        return next();
      }

      return (
        (await assetServer.fetch(context.request)) ??
        new Response("Not Found", { status: 404 })
      );
    });
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
