import type { RemixTestConfig } from "remix/test";

export default {
  glob: {
    exclude: ["node_modules/**"],
  },
  playwrightConfig: {
    projects: [
      {
        name: "chromium",
        use: { browserName: "chromium" },
      },
    ],
  },
} satisfies RemixTestConfig;
