import { defineConfig } from "vitest/config";

/**
 * Root Vitest configuration for the clearn.ai monorepo.
 *
 * Each project uses its own vitest.config.ts (with aliases, etc.).
 * Playwright E2E specs (e2e/*.spec.ts) are NOT included —
 * run them via `npx playwright test` instead.
 */
export default defineConfig({
  test: {
    projects: [
      "apps/api",
      "apps/mobile",
      "apps/web",
      "packages/contracts",
      "packages/domain",
      "packages/testkit",
    ],
  },
});
