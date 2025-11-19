import type { Config } from "@react-router/dev/config";
import { hydrogenPreset } from "@shopify/hydrogen/react-router-preset";

export default {
  presets: [hydrogenPreset()],
  future: {
    unstable_optimizeDeps: true,
  },
  appDirectory: "app",
  buildDirectory: "dist",
  ssr: true,
} satisfies Config;
