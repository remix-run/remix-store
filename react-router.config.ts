import type { Config, Preset } from "@react-router/dev/config";
import { hydrogenPreset } from "@shopify/hydrogen/react-router-preset";

const hydrogen = hydrogenPreset();

const hydrogenWithReactRouter7 = {
  ...hydrogen,
  async reactRouterConfig(args) {
    const presetConfig = (await hydrogen.reactRouterConfig?.(args)) ?? {};
    const future = { ...presetConfig.future } as Record<string, unknown>;

    // Hydrogen 2026.4.2 still emits the old React Router
    // `future.unstable_subResourceIntegrity` flag. React Router 7.15+
    // stabilized this into top-level `subResourceIntegrity`, so strip the
    // deprecated flag while preserving the rest of the Hydrogen preset.
    delete future.unstable_subResourceIntegrity;

    return {
      ...presetConfig,
      future,
      subResourceIntegrity: presetConfig.subResourceIntegrity ?? false,
    };
  },
} satisfies Preset;

export default {
  presets: [hydrogenWithReactRouter7],
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
