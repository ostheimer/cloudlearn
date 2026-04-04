import { defineConfig } from "@playwright/test";

const port = Number(process.env.CLOUDLEARN_SMOKE_PORT ?? "4173");
const host = process.env.CLOUDLEARN_SMOKE_HOST ?? "127.0.0.1";
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /cloudlearn\..+\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `node scripts/cloudlearn-preview-server.mjs`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      CLOUDLEARN_SMOKE_HOST: host,
      CLOUDLEARN_SMOKE_PORT: String(port),
      HOST: host,
      PORT: String(port),
    },
  },
});
