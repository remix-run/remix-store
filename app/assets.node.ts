import { createAssetServer } from "remix/assets";

import { browserBoundary } from "./assets.ts";

/** How the Node server runs, resolved once from the environment. */
export interface NodeMode {
  /** NODE_ENV, defaulting to "development" when unset. */
  nodeEnv: string;
  development: boolean;
  production: boolean;
  /** Development under the HMR proxy (`pnpm hmr`). */
  hmr: boolean;
}

export function resolveNodeMode(
  env: Record<string, string | undefined>,
): NodeMode {
  let nodeEnv = env.NODE_ENV ?? "development";
  let development = nodeEnv === "development";
  return {
    nodeEnv,
    development,
    production: nodeEnv === "production",
    hmr: development && Boolean(env.REMIX_NODE_HMR),
  };
}

export async function createNodeAssetServer(mode: NodeMode) {
  return createAssetServer({
    basePath: "/assets",
    mounts: {
      app: "app",
      node_modules: "node_modules",
    },
    ...browserBoundary,
    files: { extensions: [".woff2"] },
    sourceMaps: mode.development ? "external" : undefined,
    minify: !mode.development,
    watch: mode.development
      ? { ignore: ["dist/**", "node_modules/**", "test-results/**"] }
      : false,
    // Content fingerprints need files that stay put, so only production uses them.
    fingerprint: mode.production,
    hmr: mode.hmr
      ? {
          channel: async () =>
            (await import("remix/node-hmr/runtime")).createBrowserHmrChannel(),
          moduleImporter: "remix/multiple-import-maps-polyfill",
        }
      : undefined,
    scripts: {
      define: {
        "process.env.NODE_ENV": JSON.stringify(mode.nodeEnv),
      },
      loaders: mode.hmr
        ? [(await import("remix/component-hmr/assets")).componentHmr()]
        : undefined,
    },
  });
}
