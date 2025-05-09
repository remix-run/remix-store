import { defineConfig } from "vite";
import { hydrogen } from "@shopify/hydrogen/vite";
import { oxygen } from "@shopify/mini-oxygen/vite";
import tailwindcss from "@tailwindcss/vite";
import { iconsSpritesheet } from "vite-plugin-icons-spritesheet";
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  optimizeDeps: {
    force: true,
  },
  plugins: [
    hydrogen(),
    oxygen(),
    tailwindcss(),
    iconsSpritesheet({
      inputDir: "app/assets/icons",
      outputDir: "public",

      typesOutputFile: "app/components/icon/types.generated.ts",
      withTypes: true,
      iconNameTransformer: (name) =>
        name.charAt(0).toLowerCase() + name.slice(1),
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    // Allow a strict Content-Security-Policy
    // without inlining assets as base64:
    assetsInlineLimit: 0,
  },
  ssr: {
    optimizeDeps: {
      /**
       * Include dependencies here if they throw CJS<>ESM errors.
       * For example, for the following error:
       *
       * > ReferenceError: module is not defined
       * >   at /Users/.../node_modules/example-dep/index.js:1:1
       *
       * Include 'example-dep' in the array below.
       * @see https://vitejs.dev/config/dep-optimization-options
       */
      include: ["set-cookie-parser", "cookie", "spin-delay"],
    },
  },
});
