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
    baseURL: process.env.E2E_WEB_BASE_URL ?? "https://clearn-web.vercel.app",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "api",
      testMatch: /api\..+\.ts$/,
      use: {
        baseURL: process.env.E2E_API_BASE_URL ?? "https://clearn-api.vercel.app",
      },
    },
    {
      name: "web",
      testMatch: /web\..+\.ts$/,
      use: {
        baseURL: process.env.E2E_WEB_BASE_URL ?? "https://clearn-web.vercel.app",
      },
    },
  ],
});
