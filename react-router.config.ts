import type { Config } from "@react-router/dev/config";

export default {
  future: {
    unstable_optimizeDeps: true,
  },
  appDirectory: "app",
  buildDirectory: "dist",
  ssr: true,
} satisfies Config;
