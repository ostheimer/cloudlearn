import { defineConfig } from "@playwright/test";

// Synthetic local Auth/API only; a dedicated port avoids parallel PM chats.
export default defineConfig({
  testDir: "./e2e", testMatch: "local.keyboard.spec.ts", workers: 1, retries: 0,
  reporter: "list", timeout: 30000,
  use: { baseURL: "http://127.0.0.1:4193", launchOptions: { channel: "chrome" }, trace: "retain-on-failure" },
  projects: ["de-DE", "en-US"].flatMap(locale => [
    { name: `${locale}-desktop`, use: { locale, viewport: { width: 1440, height: 1000 } } },
    { name: `${locale}-mobile-width`, use: { locale, viewport: { width: 390, height: 844 } } },
  ]),
  webServer: {
    command: "pnpm --filter @clearn/web dev --hostname 127.0.0.1 --port 4193",
    url: "http://127.0.0.1:4193", reuseExistingServer: !process.env.CI, timeout: 120000,
    env: { NEXT_PUBLIC_CLEARN_API_BASE_URL: "http://127.0.0.1:4193", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
  },
});
