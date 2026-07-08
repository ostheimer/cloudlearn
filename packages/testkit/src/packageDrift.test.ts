import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

// #78: apps/web keeps a deliberate byte-identical copy of the shared learning-mode
// logic (for isolated Vercel builds). Guard it so the copy can't silently drift.
describe("package drift guard (#78)", () => {
  it("keeps apps/web/src/lib/learningModes.ts byte-identical to packages/domain/src/learningModes.ts", () => {
    const canonical = readRepoFile("packages/domain/src/learningModes.ts");
    const webCopy = readRepoFile("apps/web/src/lib/learningModes.ts");
    expect(webCopy).toBe(canonical);
  });
});
