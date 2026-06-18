import type { Config } from "@react-router/dev/config";
import { hydrogenPreset } from "@shopify/hydrogen/react-router-preset";

export default {
  presets: [hydrogenPreset()],
  appDirectory: "app",
  buildDirectory: "dist",
  future: {
    v8_middleware: true,
    v8_passThroughRequests: true,
    v8_splitRouteModules: true,
    v8_trailingSlashAwareDataRequests: true,
    // Hydrogen 2026.4.2 still relies on the pre-Environment API server build
    // layout during `shopify hydrogen build`, so keep this disabled until the
    // Hydrogen CLI supports React Router's Vite Environment API output.
    v8_viteEnvironmentApi: false,
  },
  ssr: true,
} satisfies Config;
