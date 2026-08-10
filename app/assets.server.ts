import { createAssetServer } from "remix/assets";
import type { Middleware } from "remix/router";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const buildId = process.env.ASSET_BUILD_ID;

export const assetServer = createAssetServer({
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

export function serveBrowserAssets(): Middleware {
  return async (context, next) => {
    let { pathname } = context.url;
    if (pathname !== "/assets" && !pathname.startsWith("/assets/")) {
      return next();
    }

    return (
      (await assetServer.fetch(context.request)) ??
      new Response("Not Found", { status: 404 })
    );
  };
}
