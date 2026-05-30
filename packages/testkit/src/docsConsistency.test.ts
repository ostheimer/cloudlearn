import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function sectionBetween(markdown: string, heading: string, nextHeadingLevel: string): string {
  const start = markdown.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);

  const next = markdown.indexOf(`\n${nextHeadingLevel} `, start + heading.length);
  return next === -1 ? markdown.slice(start) : markdown.slice(start, next);
}

describe("documentation status consistency", () => {
  it("keeps ROADMAP Phase 2 aligned with completed Priority B tickets", () => {
    const roadmap = readRepoFile("ROADMAP.md");
    const phase2 = sectionBetween(roadmap, "## Phase 2 - Beta Launch", "##");

    expect(phase2).not.toContain("TODO — Scaffold vorhanden, nicht funktionsfähig");
    expect(phase2).toContain("- [x] Statistiken-Dashboard (CL-B02)");
    expect(phase2).toContain("- [x] Streaks + Push-Notifications (CL-B01, CL-B04)");
  });

  it("keeps README monetization and next steps on the LP/current-priority model", () => {
    const readme = readRepoFile("README.md");
    const monetization = sectionBetween(readme, "## Monetarisierung", "##");
    const nextSteps = sectionBetween(readme, "### Nächste Schritte", "##");

    expect(monetization).not.toContain("untenstehende Tabelle ist veraltet");
    expect(monetization).toContain("LP-System (Lernpunkte)");
    expect(monetization).toContain("| KI-Scan | 10 LP | 5 LP | 5 LP |");
    expect(monetization).toContain("| `lp_pack_2000` | 2.000 LP | €9,99 |");

    expect(nextSteps).not.toContain("**Priorität A**");
    expect(nextSteps).not.toContain("**Priorität B**");
    expect(nextSteps).not.toContain("**Priorität C**");
    expect(nextSteps).toContain("**Priorität D**");
    expect(nextSteps).toContain("`CL-MON-01`/`CL-MON-02`");
  });
});
