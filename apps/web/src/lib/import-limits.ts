/**
 * Plan-Grenzen im Import-Ablauf des Webs (#411).
 *
 * Der Server lässt Scan, PDF- und URL-Import seit #428 nicht mehr über die
 * Tarifgrenzen hinaus schreiben. Die App prüft dieselben Grenzen VOR dem
 * Ausgeben von Lernpunkten (Laras Regel: verhindern statt schimpfen) — im
 * Browser erfuhr man es bisher erst hinterher. Das gleicht dieses Modul an.
 *
 * Gegenstück zu `apps/mobile/src/lib/importLimits.ts`. Bewusst eine eigene
 * Datei statt eines geteilten Pakets: Web und App teilen keinen Baukasten, und
 * ein neues Paket wäre ein größerer Umbau, als #411 rechtfertigt.
 *
 * Reine Funktionen ohne React und ohne Netz, damit sie testbar bleiben.
 *
 * NICHT enthalten ist die Warnung „nur noch Platz für N Karten", die die App
 * vor dem Speichern in ein bestehendes Deck zeigt. Im Browser wählt man kein
 * Zieldeck — jeder Import legt ein neues Deck an, und ein frisches Deck hat
 * immer alle Plätze frei. Die Warnung könnte hier nie auslösen. Sie gehört zu
 * #427 (Deck-Auswahl im Web) und ist dort mitzubauen, nicht hier vorzuhalten.
 */

export interface PlanLimits {
  maxDecks: number;
  maxCardsPerDeck: number;
}

/**
 * Ist die Deck-Grenze erreicht? `maxDecks` ist absichtlich optional: Liefert
 * der Server keine Grenzen mit (älterer Stand), wird NICHTS gesperrt. Lieber
 * einmal zu wenig vorgewarnt als ein Konto ausgesperrt, das in Wahrheit noch
 * Platz hat — der Server lehnt dann notfalls ab und bucht die Lernpunkte
 * zurück.
 */
export function isDeckLimitReached(deckCount: number, maxDecks: number | undefined): boolean {
  if (typeof maxDecks !== "number") return false;
  return deckCount >= maxDecks;
}

/** Überschrift des Hinweises. Wortgleich mit der App. */
export const DECK_LIMIT_LABEL = "Deck-Grenze erreicht";

/**
 * Der Hinweis selbst.
 *
 * Die App hängt hier noch „oder speichere die Karten in ein bestehendes Deck"
 * an. Im Browser wäre das eine Sackgasse: Diesen Weg gibt es hier nicht
 * (#427). Laras Entscheidung 21.07.: den halben Satz weglassen, den Rest
 * wörtlich lassen.
 *
 * Der Ton weicht seit 21.07. bewusst von der App ab und folgt `planLimitMessage`
 * unten: Zustand voran statt Anrede („20 von 20 Decks sind belegt" statt „Du
 * hast …"). Beide Zahlen bleiben stehen, damit nachvollziehbar ist, woran die
 * Grenze hängt.
 */
export function deckLimitMessage(deckCount: number, maxDecks: number): string {
  return (
    `${deckCount} von ${maxDecks} Decks sind belegt. ` +
    "Jeder Scan legt ein neues Deck an — lösche bitte zuerst ein Deck in der Bibliothek."
  );
}

/**
 * Was die Import-Seite anzeigen soll — oder `null`, wenn nichts anzuzeigen ist.
 *
 * Fasst „Grenze erreicht?" und „was steht da?" zusammen, damit die Seite die
 * beiden Zahlen nicht selbst auf Vorhandensein prüfen muss. `deckCount` ist
 * `null`, solange die Deckliste noch lädt: Dann wird nicht gesperrt, sonst
 * flackerte der Hinweis bei jedem Seitenaufruf kurz auf.
 */
export function deckLimitNotice(
  deckCount: number | null,
  maxDecks: number | undefined
): string | null {
  if (deckCount === null || typeof maxDecks !== "number") return null;
  if (!isDeckLimitReached(deckCount, maxDecks)) return null;
  return deckLimitMessage(deckCount, maxDecks);
}

/**
 * Ehrliche Rückmeldung, wenn nicht alles gepasst hat:
 * „163 Karten erkannt, 150 gespeichert — Deck voll."
 *
 * Betrifft im Browser auch NEUE Decks: Ein PIT-Kapitel ergibt seit #399/#408
 * über 100 Karten, die Gratis-Grenze liegt bei 150 je Deck. Passt es nicht,
 * dünnt der Server gleichmäßig aus (`selectEvenlySpread`) — ohne diesen Satz
 * sähe man nur das fertige Deck und nie, dass etwas fehlt.
 *
 * Wortgleich mit `savedSummary` in apps/mobile/src/lib/importLimits.ts.
 */
export function savedSummary(generatedCount: number, savedCount: number): string {
  if (savedCount >= generatedCount) {
    return `${savedCount} Karten gespeichert.`;
  }
  return `${generatedCount} Karten erkannt, ${savedCount} gespeichert — Deck voll.`;
}

interface ErrorLike {
  status?: number;
  code?: string;
}

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error !== "object" || error === null) return {};
  const candidate = error as ErrorLike;
  return {
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
  };
}

/**
 * Ablehnung wegen einer Tarifgrenze — nicht wegen fehlender Lernpunkte.
 *
 * Der Server antwortet hier 409 statt 402 (#428): Ein 402 lässt Clients
 * „Lernpunkte kaufen" anbieten für ein Problem, das kein Lernpunkt löst (#371).
 *
 * Geprüft wird der CODE, nicht der Status. Die App darf zusätzlich auf 409
 * prüfen, weil ihre Scan-Ansicht nur Import-Endpunkte aufruft; 409 steht in
 * dieser API aber auch für ganz anderes (NO_INVITE, ALREADY_REFERRED, Streak-
 * Schutz am Maximum). Ein Statusvergleich würde also fremde Konflikte als
 * Tarifgrenze ausgeben, sobald diese Seite je einen weiteren Endpunkt aufruft.
 */
export function isPlanLimitError(error: unknown): boolean {
  const { code } = asErrorLike(error);
  return code === "DECK_FULL" || code === "DECK_LIMIT_REACHED";
}

/**
 * Der Satz zu einer Grenz-Ablehnung — oder `null`, wenn es keine ist.
 *
 * Bewusst EIGENER Text statt der Server-Meldung: Die schlägt „oder speichere in
 * ein bestehendes Deck" vor, was es im Browser nicht gibt (#427). Beide Sätze
 * nennen ausdrücklich die Rückbuchung, weil das die erste Frage ist, wenn ein
 * bezahlter Import abbricht.
 *
 * Erreichbar bleibt das trotz der ausgegrauten Kacheln: Die Deckliste der Seite
 * kann veraltet sein (zweiter Tab, zweites Gerät), und die Grenze hält
 * serverseitig auch beim Schreiben.
 */
export function planLimitMessage(error: unknown): string | null {
  const { code } = asErrorLike(error);
  if (code === "DECK_LIMIT_REACHED") {
    return (
      "Die Deck-Grenze deines Tarifs ist erreicht. Jeder Scan legt ein neues " +
      "Deck an — lösche bitte zuerst ein Deck in der Bibliothek. Die Lernpunkte " +
      "wurden zurückgebucht."
    );
  }
  if (code === "DECK_FULL") {
    // Von DIESER Seite aus heute nicht erreichbar: Der Fall entsteht nur beim
    // Schreiben in ein bestehendes Deck, und im Browser wählt man keins aus —
    // jeder Import legt sein eigenes neues Deck an, das nie voll ist. Der Zweig
    // steht hier für #427, das die Deck-Auswahl nachliefert.
    return (
      "In dieses Deck passt keine weitere Karte. Es wurde nichts gespeichert, " +
      "die Lernpunkte wurden zurückgebucht."
    );
  }
  return null;
}
