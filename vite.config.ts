import { oxygen } from "@shopify/mini-oxygen/vite";
import { defineConfig } from "vite";

import { remixOxygen } from "./vite/remix-oxygen.ts";

export default defineConfig({
  plugins:
    process.env.NODE_ENV === "test"
      ? [remixOxygen({ serverHandler: true })]
      : [
          oxygen({
            entry: "./app/entry.oxygen.ts",
            previewEntry: "./dist/ssr/index.js",
          }),
          remixOxygen(),
        ],
});
