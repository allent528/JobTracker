import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Local stack URL, publishable key and the local secret key (tests only). Never prod values.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Must match site_url in supabase/config.toml: the magic link is built from it.
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  // The long phone-width flows take 15-25s in Firefox and WebKit.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    timezoneId: "UTC",
    trace: "on-first-retry",
  },
  // Each project has its own test users (tests/e2e/support/local-env.ts), so the browsers can run
  // side by side. `--project=chromium` for a quick run.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    // A production build: closer to what ships, and the dev server was too slow for three browsers
    // at once (Firefox Server Actions stalled past their timeouts). An already running server on
    // the port, such as `npm run dev`, is reused instead.
    command: "npm run build && npm run start",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
