import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const routeFiles = [
  "app/api/v1/learn/progress/route.ts",
  "app/api/v1/stats/due-by-deck/route.ts",
  "app/api/v1/stats/decks-by-folder/route.ts",
  "app/api/v1/folders/[id]/cards/route.ts",
  "app/api/v1/trash/route.ts",
  "app/api/v1/trash/restore/route.ts",
  "app/api/v1/cards/delete-many/route.ts",
];

function handlers(source: string): string[] {
  const starts = [...source.matchAll(/export async function (?:GET|POST|PUT|DELETE)\(/g)].map(
    (match) => match.index
  );
  return starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length));
}

describe("neu hinzugefügte API-Wege haben eine nutzerbezogene Bremse (#702)", () => {
  for (const routeFile of routeFiles) {
    it(`${routeFile}: prüft jede Methode nach der Anmeldung`, () => {
      const source = readFileSync(join(apiRoot, routeFile), "utf-8").replace(/\r\n/g, "\n");
      const routeHandlers = handlers(source);

      expect(routeHandlers.length).toBeGreaterThan(0);
      for (const handler of routeHandlers) {
        const auth = handler.indexOf("getAuthUser(");
        const limit = handler.indexOf("await enforceUserRateLimit(");
        expect(auth).toBeGreaterThan(-1);
        expect(limit).toBeGreaterThan(auth);
      }
    });
  }

  it("gewichtet Mehrfach-Löschen nach der Zahl der Karten-IDs", () => {
    const source = readFileSync(
      join(apiRoot, "app/api/v1/cards/delete-many/route.ts"),
      "utf-8"
    );
    expect(source).toContain("body.cardIds.length");
  });
});
