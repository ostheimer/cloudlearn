/**
 * Welcher „Weitermachen"-Stand gilt — lokal oder aus dem Konto (#610).
 *
 * Die Regel ist kurz, aber folgenreich: Wählt sie den älteren Stand, werden
 * genau die Karten ein zweites Mal bewertet, deren doppelte Bewertung das
 * Feature verhindern soll.
 */

import { describe, expect, it } from "vitest";
import { pickNewerProgress } from "./progress-merge";

const local = (savedAt?: string) => ({ quelle: "lokal" as const, ...(savedAt ? { savedAt } : {}) });
const server = (savedAt?: string) => ({ quelle: "konto" as const, ...(savedAt ? { savedAt } : {}) });

describe("pickNewerProgress", () => {
  it("nimmt den neueren Stand", () => {
    expect(
      pickNewerProgress(local("2026-07-30T10:00:00.000Z"), server("2026-07-29T10:00:00.000Z"))
    ).toMatchObject({ quelle: "lokal" });
    expect(
      pickNewerProgress(local("2026-07-29T10:00:00.000Z"), server("2026-07-30T10:00:00.000Z"))
    ).toMatchObject({ quelle: "konto" });
  });

  it("nimmt, was da ist, wenn eine Seite fehlt", () => {
    expect(pickNewerProgress(local("2026-07-30T10:00:00.000Z"), null)).toMatchObject({
      quelle: "lokal",
    });
    expect(pickNewerProgress(null, server("2026-07-30T10:00:00.000Z"))).toMatchObject({
      quelle: "konto",
    });
    expect(pickNewerProgress(null, null)).toBeNull();
  });

  it("behandelt einen Stand ohne Zeitstempel als den älteren", () => {
    // Merker von vor diesem Feld — beide Seiten stempeln seit derselben Version.
    expect(pickNewerProgress(local(), server("2026-07-29T10:00:00.000Z"))).toMatchObject({
      quelle: "konto",
    });
    expect(pickNewerProgress(local("2026-07-29T10:00:00.000Z"), server())).toMatchObject({
      quelle: "lokal",
    });
  });

  it("nimmt bei zwei fehlenden oder gleichen Zeitstempeln den Konto-Stand", () => {
    expect(pickNewerProgress(local(), server())).toMatchObject({ quelle: "konto" });
    const gleich = "2026-07-30T10:00:00.000Z";
    expect(pickNewerProgress(local(gleich), server(gleich))).toMatchObject({ quelle: "konto" });
  });

  it("lässt sich von einem kaputten Zeitstempel nicht täuschen", () => {
    expect(pickNewerProgress(local("kein datum"), server("2026-07-29T10:00:00.000Z"))).toMatchObject(
      { quelle: "konto" }
    );
  });
});
