import type { Config } from "@react-router/dev/config";

export default {
  future: {
    unstable_optimizeDeps: true,
    unstable_middleware: true,
  },
  appDirectory: "app",
  buildDirectory: "dist",
  ssr: true,
} satisfies Config;
