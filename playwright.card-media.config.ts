import { defineConfig } from "@playwright/test";

// Local-only acceptance: all API/auth/storage/image responses are synthetic.
export default defineConfig({
  testDir: "./e2e", testMatch: /local\.(card-media|occlusion-edit)\.spec\.ts$/, workers: 1, retries: 0,
  reporter: "list", timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:4189", launchOptions: { channel: "chrome" }, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-de", use: { viewport: { width: 1440, height: 1000 }, locale: "de-DE" } },
    { name: "mobile-de", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE" } },
    { name: "desktop-en", use: { viewport: { width: 1440, height: 1000 }, locale: "en-GB" } },
    { name: "mobile-en", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "en-GB" } },
  ],
  webServer: {
    command: "pnpm --filter @clearn/web dev --hostname 127.0.0.1 --port 4189",
    url: "http://127.0.0.1:4189", reuseExistingServer: false,
    env: { NEXT_PUBLIC_CLEARN_API_BASE_URL: "http://127.0.0.1:4189", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
  },
});
