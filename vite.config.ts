import { defineConfig } from "vite";
import { hydrogen } from "@shopify/hydrogen/vite";
import { oxygen } from "@shopify/mini-oxygen/vite";
import tailwindcss from "@tailwindcss/vite";
import { iconsSpritesheet } from "vite-plugin-icons-spritesheet";
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  optimizeDeps: {
    include: ["embla-carousel-react"],
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
});
