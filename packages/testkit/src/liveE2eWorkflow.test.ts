import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("live E2E workflow", () => {
  it("keeps the paid URL import out of unattended runs", () => {
    const workflow = readRepoFile(".github/workflows/e2e-live.yml");
    const urlImportSpec = readRepoFile("e2e/api.import-url.spec.ts");

    expect(urlImportSpec).toContain("@paid");
    expect(workflow).toContain("include_paid_import:");
    expect(workflow).toMatch(/include_paid_import:[\s\S]*?default: false/);
    expect(workflow).toContain('pnpm exec playwright test --grep-invert "@paid"');
  });

  it("requires every live E2E credential before starting the suite", () => {
    const workflow = readRepoFile(".github/workflows/e2e-live.yml");
    const normalizedWorkflow = workflow.replace(/\s+/g, " ");

    for (const secret of [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "TEST_USER_EMAIL",
      "TEST_USER_PASSWORD",
    ]) {
      expect(workflow).toContain(`${secret}: \${{ secrets.${secret} }}`);
    }

    expect(normalizedWorkflow).toContain(
      'if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ] && [ -n "$TEST_USER_EMAIL" ] && [ -n "$TEST_USER_PASSWORD" ]; then'
    );
  });
});
