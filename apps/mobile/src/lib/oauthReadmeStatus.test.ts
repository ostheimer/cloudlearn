import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readme = readFileSync(resolve(currentDir, "../../../../README.md"), "utf8");

function getReadmeSection(startHeading: string, endHeading: string) {
  const start = readme.indexOf(startHeading);
  const end = readme.indexOf(endHeading);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return readme.slice(start, end);
}

describe("README OAuth implementation status", () => {
  it("lists Apple/Google Sign-In with implemented auth features", () => {
    const implementedSection = getReadmeSection(
      "### Voll funktionsfähig",
      "### Scaffold vorhanden"
    );

    expect(implementedSection).toContain("Apple/Google Sign-In");
  });

  it("does not list implemented Apple/Google OAuth as open implementation work", () => {
    expect(readme).not.toContain("Apple/Google OAuth (CL-D05)");
  });
});
