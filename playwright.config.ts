import { defineConfig } from "@playwright/test";

/**
 * E2E test configuration for clearn.ai
 *
 * Tests run against the live Vercel deployments:
 * - API: https://clearn-api.vercel.app
 * - Web: https://clearn-web.vercel.app
 *
 * Environment variables (optional, for authenticated tests):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - TEST_USER_EMAIL
 * - TEST_USER_PASSWORD
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 30_000,
  use: {
    baseURL: "https://clearn-web.vercel.app",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "api",
      testMatch: /api\..+\.ts$/,
      use: {
        baseURL: "https://clearn-api.vercel.app",
      },
    },
    {
      name: "web",
      testMatch: /web\..+\.ts$/,
      use: {
        baseURL: "https://clearn-web.vercel.app",
      },
    },
  ],
});
