import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 3199);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER
    ? undefined
    : {
        // Invoke Next.js directly via node (no npx/cmd.exe wrapper) and bind 127.0.0.1 for reliable Windows teardown.
        command: `node ./node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
        url: baseURL,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
        timeout: 90_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
