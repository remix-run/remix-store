import { defineConfig, devices } from "@playwright/test";

/**
 * Framework-agnostic acceptance test configuration.
 * Tests run against any origin via BASE_URL environment variable.
 * Default: https://shop.remix.run (production)
 */
const BASE_URL = process.env.BASE_URL || "https://shop.remix.run";

export default defineConfig({
  testDir: "./acceptance",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60 * 1000, // 60s per test
  expect: {
    timeout: 10 * 1000, // 10s for assertions
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-no-js",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
      },
      testMatch: /.*\.nojs\.spec\.ts/,
    },
  ],
});
