import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

// #284: Ein gescheiterter Ladevorgang (offline / Serverfehler) sah in der
// Deck-Ansicht exakt aus wie ein leeres Deck — „Noch keine Karten in diesem
// Deck.", kein Hinweis, kein „Erneut versuchen". Wer ein intaktes Deck offline
// öffnete, musste glauben, seine Karten seien weg. Gleiche Fehlerklasse wie
// #208 (dort für decks/quiz/match/learn behoben); diese Datei fehlte noch.
describe("mobile deck screen – Ladefehler ist kein leeres Deck", () => {
  const source = read("app/(tabs)/deck/[id].tsx");

  const loadCards = source.slice(
    source.indexOf("const loadCards = useCallback"),
    source.indexOf("useEffect(() => {\n    loadCards();"),
  );

  it("setzt den Fehler NUR, wenn der Offline-Cache nichts liefern konnte", () => {
    // Kern des Fixes: Rettet der Cache die Ansicht, ist das ein Erfolgsfall —
    // dann darf kein Fehler erscheinen. Der Fehler hängt deshalb im else-Zweig.
    expect(loadCards).not.toBe("");
    expect(loadCards.replace(/\s+/g, " ")).toContain(
      "if (cachedCards) {",
    );
    expect(loadCards).toMatch(
      /if \(cachedCards\) \{[\s\S]*setCards\(cachedCards\);[\s\S]*\} else \{[\s\S]*setLoadError\(true\);[\s\S]*\}/,
    );
    // Genau eine Stelle setzt den Fehler — und die liegt hinter dem Cache.
    expect(loadCards.match(/setLoadError\(true\)/g)).toHaveLength(1);
  });

  it("setzt die Fehler-Markierung zu Beginn JEDES Versuchs zurück", () => {
    // Ohne Reset bliebe ein alter Fehler nach einem geglückten Laden stehen.
    // Der Reset steht vor dem try, gilt also auch für Retry und Pull-to-Refresh,
    // weil beide über dasselbe loadCards laufen.
    expect(loadCards).toMatch(/if \(!deckId\) return;\n\s*setLoadError\(false\);\n\s*try \{/);
    expect(source).toContain("const retryLoad = () => {");
    expect(source).toMatch(/const retryLoad = \(\) => \{[\s\S]*loadCards\(\);[\s\S]*\};/);
    expect(source).toMatch(/const onRefresh = \(\) => \{[\s\S]*loadCards\(\);[\s\S]*\};/);
  });

  it("hält Fehler- und Leer-Zustand als getrennte Zweige auseinander", () => {
    // Der Fehlerzweig kommt VOR cards.length === 0, sonst würde der Ladefehler
    // weiterhin in der „leeres Deck"-Meldung verschwinden.
    const errorBranch = source.indexOf(") : loadError ? (");
    const emptyBranch = source.indexOf(") : cards.length === 0 ? (");
    expect(errorBranch).toBeGreaterThan(-1);
    expect(emptyBranch).toBeGreaterThan(-1);
    expect(errorBranch).toBeLessThan(emptyBranch);
  });

  it("bietet im Fehlerfall einen ehrlichen Hinweis samt „Erneut versuchen“", () => {
    const errorView = source.slice(
      source.indexOf(") : loadError ? ("),
      source.indexOf(") : cards.length === 0 ? ("),
    );
    // Bestehende Schlüssel wiederverwendet — dieselben wie in decks.tsx (#208):
    // "Konnte nicht laden — bist du offline?" und "Erneut versuchen".
    expect(errorView).toContain('t("common.loadError")');
    expect(errorView).toContain('t("common.retry")');
    expect(errorView).toContain("onPress={retryLoad}");
    // Und ausdrücklich NICHT die Leer-Meldung.
    expect(errorView).not.toContain("Noch keine Karten in diesem Deck");
  });

  it("lässt den echten Leer-Zustand mit dem „+ Karte“-Hinweis unangetastet", () => {
    const emptyView = source.slice(source.indexOf(") : cards.length === 0 ? ("));
    expect(emptyView).toContain("Noch keine Karten in diesem Deck.");
    expect(emptyView).toContain('Tippe "+ Karte"');
  });

  it("hält die Lernmodus-Knöpfe weiterhin an cards.length fest", () => {
    // Im Fehlerfall gibt es keine Karten zum Lernen — die Knöpfe bleiben also
    // aus. Dieses Gate war korrekt und darf sich nicht verschoben haben.
    expect(source).toContain("{!loading && cards.length >= 1 && (");
  });

  it("nutzt keine Emojis und keine Glyphen", () => {
    // Projektregel: gezeichnete Icons oder Klartext — nichts anderes.
    const errorView = source.slice(
      source.indexOf(") : loadError ? ("),
      source.indexOf(") : cards.length === 0 ? ("),
    );
    expect(errorView).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
