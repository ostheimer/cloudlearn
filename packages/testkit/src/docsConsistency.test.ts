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

    expect(phase2).toContain("- [x] Statistiken-Dashboard (CL-B02)");
    expect(phase2).toContain("- [x] Streaks + Push-Notifications (CL-B01, CL-B04)");
    expect(phase2).not.toContain("Scaffold vorhanden, nicht funktionsfähig");
  });

  it("keeps README monetization on the current LP model", () => {
    const readme = readRepoFile("README.md");
    const monetization = sectionBetween(readme, "## Monetarisierung", "##");

    expect(monetization).toContain("LP-System (Lernpunkte)");
    expect(monetization).toContain("apps/api/src/lib/featureGates.ts");
    expect(monetization).toContain("| LP-Cost KI-Scan | 10 LP | 5 LP | 5 LP |");
    expect(monetization).toContain("| Power | `lp_pack_2000` | 2.000 LP | €9,99 |");
    expect(monetization).not.toContain("untenstehende Tabelle ist veraltet");
  });

  it("keeps README API overview aligned with LP and social endpoints", () => {
    const readme = readRepoFile("README.md");
    const apiOverview = sectionBetween(readme, "## API-Struktur", "### API-Designprinzipien");

    for (const route of ["/usage", "/lp", "/leaderboard", "/friends", "/push", "/referral"]) {
      expect(apiOverview).toContain(route);
    }
  });
});
