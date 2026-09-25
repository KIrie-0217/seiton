import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the browser mock (`npm run dev:mock`) in real
 * Chromium: real layout, focus and scrolling, which jsdom unit tests cannot
 * check. The real Tauri app is not driven here (see e2e/README.md).
 */
const PORT = 1430; // separate from the 1420 dev server you may already be running

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-US",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: `npm run dev:mock -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
