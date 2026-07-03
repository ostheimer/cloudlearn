import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function listApiV1RouteGroups(): string[] {
  const apiRoot = resolve(repoRoot, "apps/api/app/api/v1");

  return readdirSync(apiRoot)
    .filter((entry) => statSync(resolve(apiRoot, entry)).isDirectory())
    .map((entry) => `/${entry}`)
    .sort();
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

  it("keeps README API overview aligned with actual v1 route groups", () => {
    const readme = readRepoFile("README.md");
    const apiOverview = sectionBetween(readme, "## API-Struktur", "### API-Designprinzipien");

    for (const routeGroup of listApiV1RouteGroups()) {
      expect(apiOverview, routeGroup).toContain(routeGroup);
    }

    for (const nestedRoute of [
      "/:id/details",
      "/:id/duplicate",
      "/:id/export",
      "/:id/share",
      "/share/:token",
      "/:id/decks",
      "/pdf",
      "/sign",
      "/classes",
    ]) {
      expect(apiOverview, nestedRoute).toContain(nestedRoute);
    }
  });

  it("keeps README implementation status date aligned with June feature updates", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("## Implementierungsstatus (Basis 2026-02-13, ergänzt 2026-06)");
  });

  it("keeps ROADMAP competitor table aligned with completed learning modes", () => {
    const roadmap = readRepoFile("ROADMAP.md");
    const comparison = sectionBetween(roadmap, "### Feature-Vergleich mit Wettbewerbern", "##");

    expect(comparison).toContain("| Test-Modus (MC, Wahr/Falsch) | ✅ | ❌ | ❌ | **✅** |");
    expect(comparison).toContain("| Match-Spiel (Timer) | ✅ | ❌ | ❌ | **✅** |");
    expect(comparison).toContain("| Image Occlusion | ✅ (Scaffold) | Add-on | ❌ | **✅** (Scaffold) |");
  });

  it("keeps monetization concept core LP values aligned with featureGates", () => {
    const concept = readRepoFile("docs/monetization/MONETIZATION_CONCEPT.md");

    expect(concept).not.toContain("VERALTET");
    expect(concept).not.toContain("Werte divergieren");
    expect(concept).toContain("| **Free** | 0 € | — | 0 LP");
    expect(concept).toContain("| **Pro Monthly** | 4,99 € | monatlich, 7 Tage Gratis-Test | 300 LP |");
    expect(concept).toContain("| KI-Scan (Kamera/Text) | 10 LP | 5 LP |");
    expect(concept).toContain("| PDF-Import | 20 LP | 12 LP |");
    expect(concept).toContain("| Power | 2.000 LP | 9,99 € | 0,0050 € | `lp_pack_2000` |");
  });

  it("keeps documentation table separators valid markdown", () => {
    for (const path of ["README.md", "docs/monetization/MONETIZATION_CONCEPT.md"]) {
      expect(readRepoFile(path), path).not.toContain("|>");
    }
  });

  it("keeps core documentation free of trailing whitespace", () => {
    for (const path of ["ROADMAP.md", "docs/monetization/MONETIZATION_CONCEPT.md"]) {
      const trailingWhitespaceLines = readRepoFile(path)
        .split("\n")
        .flatMap((line, index) => (/[ \t]+$/.test(line) ? [`${path}:${index + 1}`] : []));

      expect(trailingWhitespaceLines, path).toEqual([]);
    }
  });

  it("keeps ROADMAP German quote pairs typographic", () => {
    const mismatchedQuoteLines = readRepoFile("ROADMAP.md")
      .split("\n")
      .flatMap((line, index) => (/„[^“\n]*"/.test(line) ? [`ROADMAP.md:${index + 1}`] : []));

    expect(mismatchedQuoteLines).toEqual([]);
  });

  it("keeps ROADMAP last-updated date aligned with its latest changelog entry", () => {
    const roadmap = readRepoFile("ROADMAP.md");
    const headerDate = roadmap.match(/^Letzte Aktualisierung: (\d{4}-\d{2}-\d{2})/m)?.[1];
    const changelogDates = Array.from(roadmap.matchAll(/^- (\d{4}-\d{2}-\d{2}): /gm), ([, date]) => date);
    const sortedDates = [...changelogDates].sort();

    expect(headerDate).toBeDefined();
    expect(sortedDates.length).toBeGreaterThan(0);
    expect(headerDate).toBe(sortedDates[sortedDates.length - 1]);
  });

  it("does not list already resolved documentation discrepancies in AGENTS", () => {
    const agents = readRepoFile("AGENTS.md");
    const roadmap = readRepoFile("ROADMAP.md");
    const readme = readRepoFile("README.md");

    const phase2 = sectionBetween(roadmap, "## Phase 2 - Beta Launch", "##");
    const nextSteps = sectionBetween(readme, "### Nächste Schritte", "##");
    const monetization = sectionBetween(readme, "## Monetarisierung", "##");

    expect(phase2).toContain("- [x] Statistiken-Dashboard (CL-B02)");
    expect(phase2).toContain("- [x] Streaks + Push-Notifications (CL-B01, CL-B04)");
    expect(nextSteps).not.toContain("**Priorität A**");
    expect(nextSteps).not.toContain("**Priorität B**");
    expect(nextSteps).not.toContain("**Priorität C**");
    expect(monetization).not.toContain("untenstehende Tabelle ist veraltet");

    expect(agents).not.toContain("ROADMAP.md Phase 2 — internal inconsistency");
    expect(agents).not.toContain('README.md "Nächste Schritte" — outdated priorities');
    expect(agents).not.toContain("README.md Monetarisierung — veraltete Tabelle");
  });
});
