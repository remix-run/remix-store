import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.BASE_URL;
const localBaseUrl = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm dev --port 3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: localBaseUrl,
      },
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*\.nojs\.spec\.ts/,
      use: devices["Desktop Chrome"],
    },
    {
      name: "chromium-no-js",
      testMatch: /.*\.nojs\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
      },
    },
  ],
});
