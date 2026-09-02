import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1144, height: 900 },
  },
  webServer: {
    command: "pnpm exec next dev -p 3100",
    url: "http://localhost:3100/components/path-marquee",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
