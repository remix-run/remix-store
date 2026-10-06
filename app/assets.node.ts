import { createAssetServer } from "remix/assets";

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
      ? [(await import("remix/component-hmr/assets")).componentHmr()]
      : undefined,
  },
};
if (buildId) assetServerOptions.fingerprint = true;

export const assets = createAssetServer(assetServerOptions);
