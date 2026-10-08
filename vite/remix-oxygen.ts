import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { remix } from "@pitlane/vite-plugin-remix";
import { build, type Plugin, type PluginOption } from "vite";

import { documentAssetSources } from "../app/assets.ts";

interface RemixOxygenOptions {
  compatibilityDate: string;
}

// Pitlane writes its build manifest beside the server bundle.
const MANIFEST_FILE = "__pitlane_assets_manifest.js";

/** Pitlane's Remix integration, finished into the single Worker Oxygen deploys. */
export function remixOxygen({
  compatibilityDate,
}: RemixOxygenOptions): PluginOption {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate))
    throw new Error(`Invalid Oxygen compatibility date: ${compatibilityDate}`);
  let { scriptEntry, stylesheet, fonts } = documentAssetSources;

  const oxygenWorker: Plugin = {
    name: "remix-oxygen:worker",
    config() {
      return {
        environments: {
          ssr: {
            optimizeDeps: { include: ["sanitize-html"] },
            build: {
              outDir: "dist/server",
              copyPublicDir: false,
              rolldownOptions: { output: { codeSplitting: false } },
            },
          },
        },
      };
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        // MiniOxygen emits its own `oxygen.json`, which Pitlane would copy into
        // the public client directory. Ours is written once the build is done.
        delete bundle["oxygen.json"];
      },
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
        await rm(resolve(outDir, MANIFEST_FILE));
        await writeFile(
          resolve(outDir, "oxygen.json"),
          JSON.stringify(
            { version: 1, compatibility_date: compatibilityDate },
            null,
            2,
          ),
        );
      },
    },
  };

  let pitlane = remix({
    serverEntry: "app/entry.oxygen.ts",
    clientEntry: scriptEntry,
    // MiniOxygen serves development requests inside its Worker runtime.
    serverHandler: false,
    assets: {
      chunkImportMap: false,
      include: [stylesheet, ...Object.values(fonts)],
    },
  });
  if (!Array.isArray(pitlane))
    throw new Error("Expected Pitlane's Remix plugin list.");

  return [
    // MiniOxygen previews the Worker. Pitlane's preview would import the same
    // Worker into Node and compete for requests.
    pitlane.filter(
      (plugin) =>
        !(plugin && "name" in plugin) ||
        plugin.name !== "pitlane-remix-preview-server",
    ),
    oxygenWorker,
  ];
}
