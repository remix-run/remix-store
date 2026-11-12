import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { ASSETS_MANIFEST_FILE } from "@pitlane/assets/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import type { OxygenPlugin } from "@shopify/mini-oxygen/vite";
import { build, type Plugin, type PluginOption } from "vite";

import { browserBoundary, documentAssetSources } from "../app/assets.ts";

interface RemixOxygenOptions {
  compatibilityDate: string;
}

/** Pitlane's Remix integration, finished into the single Worker Oxygen deploys. */
export function remixOxygen({
  compatibilityDate,
}: RemixOxygenOptions): PluginOption {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate))
    throw new Error(`Invalid Oxygen compatibility date: ${compatibilityDate}`);
  let { scriptEntry, stylesheet, fonts } = documentAssetSources;

  const oxygenWorker: Plugin = {
    name: "remix-oxygen:worker",
    configResolved(config) {
      // MiniOxygen otherwise infers the date from the Hydrogen version. One
      // pinned date keeps `vite dev`, `vite preview`, and the `oxygen.json` it
      // emits for deployment on the same Workers runtime.
      let oxygen = config.plugins.find(
        (plugin): plugin is OxygenPlugin => plugin.name === "oxygen:main",
      );
      if (!oxygen?.api)
        throw new Error("remixOxygen() requires MiniOxygen's oxygen() plugin.");
      oxygen.api.registerPluginOptions({ compatibilityDate });
    },
    config(_config, { command }) {
      // `shopify hydrogen deploy` passes each deployment's CDN prefix, so
      // assets stay at their own URLs after later deployments replace this one.
      let assetBase = process.env.HYDROGEN_ASSET_BASE_URL;
      return {
        base: command === "build" && assetBase ? assetBase : undefined,
        environments: {
          ssr: {
            build: {
              outDir: "dist/server",
              copyPublicDir: false,
              rolldownOptions: { output: { codeSplitting: false } },
            },
          },
        },
      };
    },
    buildApp: {
      // Runs after Pitlane has built both environments and written its manifest.
      order: "post",
      async handler(builder) {
        let ssr = builder.environments.ssr!;
        let outDir = resolve(builder.config.root, ssr.config.build.outDir);
        // Oxygen uploads only `index.js` and `oxygen.json` from the Worker
        // directory, so bundle the manifest into the Worker itself.
        let output = await build({
          configFile: false,
          root: builder.config.root,
          logLevel: builder.config.logLevel,
          ssr: { noExternal: true, target: "webworker" },
          build: {
            ssr: resolve(outDir, "index.js"),
            outDir,
            emptyOutDir: false,
            copyPublicDir: false,
            target: "esnext",
            minify: ssr.config.build.minify,
            sourcemap: ssr.config.build.sourcemap,
            rolldownOptions: {
              output: { entryFileNames: "index.js", codeSplitting: false },
            },
          },
        });
        let chunks =
          "output" in output
            ? output.output.filter((file) => file.type === "chunk")
            : [];
        if (chunks.length !== 1 || chunks[0]!.imports.length)
          throw new Error("Expected one self-contained Oxygen Worker module.");
        await rm(resolve(outDir, ASSETS_MANIFEST_FILE));
      },
    },
  };

  return [
    remix({
      serverEntry: "app/entry.oxygen.ts",
      clientEntry: scriptEntry,
      // MiniOxygen serves development requests and previews the built Worker.
      serverHandler: false,
      assets: {
        ...browserBoundary,
        include: [stylesheet, ...Object.values(fonts)],
      },
    }),
    oxygenWorker,
  ];
}
