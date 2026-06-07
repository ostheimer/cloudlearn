import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as Record<string, unknown>;
}

describe("deployment configuration", () => {
  it("keeps the API Vercel build on the workspace pnpm lockfile", () => {
    const apiVercel = readJson("apps/api/vercel.json");

    expect(apiVercel.installCommand).toBe("pnpm install --frozen-lockfile");
  });
});
