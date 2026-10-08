import { defineConfig } from "@playwright/test";

// Fully local UI acceptance. Auth/API responses are synthetic and intercepted
// by the spec; no developer account or deployed backend is used.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "local.resume.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    launchOptions: { channel: "chrome" },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @clearn/web dev --hostname 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_CLEARN_API_BASE_URL: "http://127.0.0.1:4175",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    },
  },
});
