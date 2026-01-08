import type { Config } from "@react-router/dev/config";
import { hydrogenPreset } from "@shopify/hydrogen/react-router-preset";

// Renames stabilized future flags from Hydrogen's outdated unstable_ names
function patchedHydrogenPreset() {
  const preset = hydrogenPreset();
  return {
    ...preset,
    async reactRouterConfig(
      args: Parameters<NonNullable<typeof preset.reactRouterConfig>>[0],
    ) {
      const config = await preset.reactRouterConfig!(args);

      return {
        ...config,
        future: {
          v8_middleware: true,
          v8_splitRouteModules: true,
          v8_viteEnvironmentApi: false,
          unstable_optimizeDeps: true,
          unstable_subResourceIntegrity: false,
        } satisfies Config["future"],
      };
    },
  };
}

export default {
  presets: [patchedHydrogenPreset()],
  appDirectory: "app",
  buildDirectory: "dist",
  ssr: true,
} satisfies Config;
