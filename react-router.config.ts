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
  ssr: true,
} satisfies Config;
