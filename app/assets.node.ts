import { createAssetServer } from "remix/assets";

import { browserBoundary } from "./assets.ts";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const isProduction = nodeEnv === "production";
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

const assetServerOptions: Parameters<typeof createAssetServer>[0] = {
  basePath: "/assets",
  mounts: {
    app: "app",
    node_modules: "node_modules",
  },
  ...browserBoundary,
  files: { extensions: [".woff2"] },
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: isDevelopment
    ? { ignore: ["dist/**", "node_modules/**", "test-results/**"] }
    : false,
  // Content fingerprints need files that stay put, so only production uses them.
  fingerprint: isProduction,
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
      ? [(await import("remix/component-hmr/assets")).componentHmr()]
      : undefined,
  },
};
export const assets = createAssetServer(assetServerOptions);
