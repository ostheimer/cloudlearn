import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

/**
 * #406, Rest: Jeder Bildschirm schickt jetzt sein eigenes Lernmodus-Etikett
 * mit. Ohne das landet ALLES als "flashcard" im Protokoll und die Statistik
 * kann die Modi nicht auseinanderhalten.
 *
 * Die Bildschirme unter app/ haben in dieser Suite keine Laufzeit-Umgebung
 * (vitest läuft mit environment "node", react-native wird nicht transformiert),
 * also wird der QUELLTEXT geprüft — dieselbe Konvention wie
 * occlusion-pro-hint.test.ts, deck-view-load-error.test.ts und
 * learn-session-lp-screens.test.ts. Das ist bewusst eine Struktur- und keine
 * Verhaltensprüfung: Sie belegt, dass das Etikett an der richtigen STELLE
 * steht, nicht dass der Server es empfängt.
 */

/**
 * Schneidet den vollständigen Aufruf `name(...)` heraus, Klammern mitgezählt.
 *
 * Der Grund für diesen Aufwand: Lernen, Üben und Lückentext reichen das
 * Warteschlangen-Payload an reviewCard durch. Ein `mode` irgendwo sonst im
 * Bildschirm käme deshalb NIE auf die Leitung. Nur ein Etikett INNERHALB des
 * createReviewSyncOperation-Aufrufs wirkt — und genau darauf wird geprüft.
 */
function extractCall(source: string, name: string): string {
  const start = source.indexOf(`${name}(`);
  if (start === -1) return "";
  let depth = 0;
  for (let i = start + name.length; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

// Die drei Bildschirme, die ihr Payload durchreichen. Für sie MUSS das Etikett
// im Payload stehen.
const PAYLOAD_SCREENS: { name: string; rel: string; mode: string }[] = [
  { name: "learn (Karteikarten)", rel: "app/(tabs)/learn.tsx", mode: "flashcard" },
  { name: "practice (Üben)", rel: "app/practice.tsx", mode: "practice" },
  { name: "cloze (Lückentext)", rel: "app/cloze.tsx", mode: "cloze" },
];

for (const { name, rel, mode } of PAYLOAD_SCREENS) {
  describe(`mobile ${name} – meldet mode "${mode}"`, () => {
    const source = read(rel);

    it("setzt das Etikett IM Warteschlangen-Payload", () => {
      const call = extractCall(source, "createReviewSyncOperation");
      expect(call).not.toBe("");
      expect(call).toContain(`mode: "${mode}"`);
    });

    it("reicht genau dieses Payload an reviewCard durch", () => {
      // Belegt die Kette Payload → Leitung. Ginge der Bildschirm auf ein
      // eigenes Optionen-Objekt über, träfe die Prüfung oben ins Leere.
      const call = extractCall(source, "reviewCard");
      expect(call).not.toBe("");
      expect(call).toMatch(/\.payload,?\s*\)$/);
    });

    it("schickt kein fremdes Etikett", () => {
      const others = ["flashcard", "practice", "cloze", "occlusion", "quiz", "match", "test"].filter(
        (m) => m !== mode
      );
      for (const other of others) {
        expect(source).not.toContain(`mode: "${other}"`);
      }
    });
  });
}

/**
 * Die vier Bildschirme, die seit #460 über den gemeinsamen Helfer senden.
 *
 * Vorher baute jeder sein eigenes `reviewCard(...).catch(() => {})` — und alle
 * vier warfen Antworten bei Netzproblemen still weg. Für sie steht das Etikett
 * jetzt im sendReview-Aufruf; die Warteschlange füllt der Helfer.
 *
 * Der frühere Sonderfall occlusion ist damit keiner mehr: Sein Kommentar hier
 * lautete „Bild-Abdecken kennt keine Offline-Warteschlange" — das beschrieb
 * genau den Fehler aus #460 als gewolltes Verhalten.
 */
const HELPER_SCREENS: { name: string; rel: string; mode: string }[] = [
  { name: "occlusion (Bild-Abdecken)", rel: "app/occlusion.tsx", mode: "occlusion" },
  { name: "quiz (Multiple Choice)", rel: "app/quiz.tsx", mode: "quiz" },
  { name: "match (Zuordnen)", rel: "app/match.tsx", mode: "match" },
  { name: "test (Prüfung)", rel: "app/test.tsx", mode: "test" },
];

for (const { name, rel, mode } of HELPER_SCREENS) {
  describe(`mobile ${name} – meldet mode "${mode}" über den Helfer`, () => {
    const source = read(rel);

    it("setzt das Etikett IM sendReview-Aufruf", () => {
      const call = extractCall(source, "sendReview");
      expect(call).not.toBe("");
      expect(call).toContain(`mode: "${mode}"`);
    });

    it("ruft reviewCard nicht mehr selbst", () => {
      // Der eigene Aufruf war die Ursache von #460: ohne Warteschlange gingen
      // Antworten bei wackelndem Netz spurlos verloren.
      expect(source).not.toMatch(/reviewCard\(/);
    });

    it("schickt kein fremdes Etikett", () => {
      const others = ["flashcard", "practice", "cloze", "occlusion", "quiz", "match", "test"].filter(
        (m) => m !== mode
      );
      for (const other of others) {
        expect(source).not.toContain(`mode: "${other}"`);
      }
    });
  });
}

describe("mobile Warteschlange – trägt das Etikett mit", () => {
  const api = read("src/lib/api.ts");
  const store = read("src/features/sync/offlineQueueStore.ts");

  it("ReviewSyncPayload kennt mode — und zwar optional", () => {
    const from = api.indexOf("export interface ReviewSyncPayload {");
    const to = api.indexOf("}", from);
    const block = from > -1 ? api.slice(from, to) : "";
    expect(block).not.toBe("");
    expect(block).toContain("mode?: ReviewMode;");
    // Pflichtfeld wäre ein Bruch: Warteschlangen-Einträge, die VOR dieser
    // Änderung auf dem Gerät gespeichert wurden, haben kein mode. Sie müssen
    // weiter durchlaufen — der Server trägt für sie "flashcard" ein.
    expect(block).not.toContain("mode: ReviewMode;");
  });

  it("createReviewSyncOperation nimmt mode entgegen und legt es ins Payload", () => {
    expect(store).toContain("mode?: ReviewMode;");
    expect(store).toContain("payload.mode = input.mode;");
  });

  it("schreibt mode nur, wenn eines angegeben wurde", () => {
    // Ohne diese Bedingung stünde `mode: undefined` im Payload und würde
    // mitgespeichert — überflüssiger Ballast in der Warteschlange.
    const from = store.indexOf("if (input.mode !== undefined) {");
    expect(from).toBeGreaterThan(-1);
    expect(store.slice(from, from + 120)).toContain("payload.mode = input.mode;");
  });
});

/**
 * Alle sieben Etiketten an einer Stelle — damit nachlesbar bleibt, welcher
 * Bildschirm was meldet, ohne sieben Dateien öffnen zu müssen.
 */
describe("mobile – alle sieben Modi melden ihr eigenes Etikett", () => {
  const ALLE: { rel: string; mode: string }[] = [
    { rel: "app/(tabs)/learn.tsx", mode: "flashcard" },
    { rel: "app/practice.tsx", mode: "practice" },
    { rel: "app/cloze.tsx", mode: "cloze" },
    { rel: "app/occlusion.tsx", mode: "occlusion" },
    { rel: "app/quiz.tsx", mode: "quiz" },
    { rel: "app/match.tsx", mode: "match" },
    { rel: "app/test.tsx", mode: "test" },
  ];

  for (const { rel, mode } of ALLE) {
    it(`${rel} meldet "${mode}"`, () => {
      expect(read(rel)).toContain(`mode: "${mode}"`);
    });
  }
});
