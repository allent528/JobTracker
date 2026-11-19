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
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  // Each project has its own test users (the `users` fixture), so the browsers run side by side.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, timeout: 60_000 },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, timeout: 60_000 },
  ],
  webServer: {
    // A fresh production build each run; E2E_REUSE_SERVER=1 tests whatever already runs on the port.
    command: "npm run build && npm run start",
    url: `${baseURL}/login`,
    reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
    timeout: 300_000,
  },
});
