import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Local stack URL, publishable key and the local secret key (tests only). Never prod values.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Chromium only for now; add Firefox and WebKit before launch (owner decision, step 1).
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
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
