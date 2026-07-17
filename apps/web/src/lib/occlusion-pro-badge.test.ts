import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

// #364 (letzter Schritt): Occlusion ist serverseitig eine Pro-Funktion (#352).
// Der Editor weist Free-Nutzerinnen seit #376 vorab ab — auf der Deck-Seite fehlte
// aber noch das Schild, das die Zeile überhaupt als Pro ausweist. Gegenstück zum
// statischen Pro-Schild der App (#376, app/(tabs)/deck/[id].tsx).
describe("web deck-seite – statisches Pro-Schild am Occlusion-Eintrag", () => {
  const source = readFileSync(
    join(webRoot, "app/dashboard/deck/[id]/page.tsx"),
    "utf-8",
  ).replace(/\r\n/g, "\n");

  // Der Occlusion-Eintrag ist NICHT Teil von MODES (dort stehen flip/mcq/match/
  // cloze/test); er wird als eigener Link gerendert. Alle Prüfungen unten sehen
  // nur diesen Ausschnitt an — sonst schlagen sie auf fremdem Code an.
  const entry = source.slice(
    source.indexOf("{/* Occlusion-Kachel:"),
    source.indexOf("{cards.length === 0 ? ("),
  );

  it("findet den Occlusion-Eintrag überhaupt (sonst prüft alles darunter Luft)", () => {
    expect(entry).not.toBe("");
    expect(entry).toContain(
      'href={`/dashboard/deck/${deckId}/${hasOcclusion ? "occlusion" : "occlusion/new"}`}',
    );
  });

  it("zeigt Pro als Schild an der Zeile", () => {
    expect(entry).toContain('<span\n                    className="mode-card__badge"');
    expect(entry).toContain(">\n                    Pro\n                  </span>");
  });

  it("ist statisch — keine Tarif-Abfrage auf dieser Seite", () => {
    // Der Kern der Entscheidung (#376): ohne Tarif-Abfrage kann das Schild
    // niemanden fälschlich sperren und kostet keine Anfrage bei jedem
    // Deck-Öffnen. Geprüft wird die GANZE Datei, nicht nur der Eintrag: ein
    // Tarif-Getter irgendwo oben wäre genau der Fehler, den wir ausschließen.
    expect(source).not.toMatch(/getLpBalance|getSubscriptionStatus|featureGates/);
    expect(source).not.toMatch(/\btier\b|subscription/i);
    // Die Importliste aus @/lib/api bleibt unangetastet — dort kam nichts dazu.
    const apiImport = source.slice(source.indexOf('import {\n  getDeckDetails'), source.indexOf('} from "@/lib/api";'));
    expect(apiImport).toContain("getDeckDetails");
    expect(apiImport).not.toMatch(/Lp|lp|tier|subscription/);
  });

  it("ist ein Schild, keine Sperre — der Link navigiert weiter wie bisher", () => {
    // Ein Pro-Schild darf die Zeile NICHT tot machen: Free-Nutzerinnen sollen den
    // Editor weiterhin öffnen und dort den Vorab-Hinweis aus #376 lesen.
    expect(entry).toContain("<Link");
    expect(entry).not.toContain("aria-disabled");
    expect(entry).not.toMatch(/disabled|preventDefault|pointer-events|onClick/);
    // Ausgegraut wird weiterhin allein an „noch kein Bild" entschieden, nicht am
    // Tarif — und auch dann bleibt es ein Link zum Editor.
    expect(entry).toContain('className={`mode-card${hasOcclusion ? "" : " mode-card--soon"}`}');
  });

  it("bleibt bei Klartext — keine Emojis, keine Glyphen", () => {
    // Projektregel: gezeichnete Icons (lucide) oder Klartext, nichts dazwischen.
    // Ein Schloss-/Stern-/Blitz-Zeichen im Text wäre genau der Rückfall.
    const badge = entry.slice(entry.indexOf('className="mode-card__badge"'));
    const label = badge.slice(badge.indexOf(">") + 1, badge.indexOf("</span>"));
    expect(label.trim()).toBe("Pro");
    // Nur ASCII-Buchstaben — schließt Emojis, Symbole und Piktogramme aus.
    expect(label.trim()).toMatch(/^[A-Za-z]+$/);
    // Und im ganzen Eintrag kein Emoji/Symbol-Zeichen (die Bindestriche und „—"
    // in den Untertiteln sind Satzzeichen, keine Piktogramme).
    expect(entry).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("erfindet keine neue Optik, sondern nimmt vorhandene (Schild-Form + #369-Farbe)", () => {
    // .mode-card__badge ist das Schild dieser Zeile (bisher „zu wenige"), die
    // Farbe ist die des KI-Abzeichens aus #369 (.tag--ai) — beides schon da,
    // also kein neuer CSS-Block und kein neuer Look.
    expect(entry).toContain(
      'style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--brand)" }}',
    );
  });
});
