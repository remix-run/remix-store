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
          // The preview package's 2026-10 date is not available in Oxygen yet.
          remixOxygen({ compatibilityDate: "2026-04-01" }),
        ],
});
