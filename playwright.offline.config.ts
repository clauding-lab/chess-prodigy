import { defineConfig, devices } from "@playwright/test";

// Each test serves its own disposable origin and then stops that server.
// No account server, live data, network routing or offline-emulation workaround.
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "offline-origin.spec.ts",
  timeout: 30000,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/offline-origin",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "chrome-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        channel: process.env.CI ? undefined : "chrome",
      },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
});
