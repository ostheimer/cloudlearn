/**
 * Plan-Grenzen im Scan-Ablauf (#411).
 *
 * Der Server lässt Scan, PDF- und URL-Import seit #411 nicht mehr über die
 * Tarifgrenzen hinaus schreiben. Damit die Nutzerin das nicht erst NACH dem
 * Bezahlen von Lernpunkten erfährt, prüft die App dieselben Grenzen vorher —
 * Laras Regel: verhindern statt schimpfen.
 *
 * Reine Funktionen ohne React/Netz, damit sie testbar bleiben.
 */

/** Ab wie wenigen freien Plätzen vor dem Speichern gewarnt wird. */
export const NEARLY_FULL_THRESHOLD = 30;

export interface PlanLimits {
  maxDecks: number;
  maxCardsPerDeck: number;
}

export interface DeckLike {
  cardCount?: number;
  imageCardCount?: number;
}

/**
 * Freie Kartenplätze eines Decks. Zählt Karteikarten UND Bild-Karten, weil der
 * Server beim Durchsetzen der Grenze ebenfalls jede lebende Karte zählt.
 * Ein Deck, das die Grenze schon überschreitet (die gibt es in Produktion),
 * liefert 0 — seine Karten bleiben unangetastet, es kommen nur keine dazu.
 */
export function freeCardSlots(deck: DeckLike, maxCardsPerDeck: number): number {
  const used = (deck.cardCount ?? 0) + (deck.imageCardCount ?? 0);
  return Math.max(0, maxCardsPerDeck - used);
}

export function isDeckLimitReached(deckCount: number, maxDecks: number): boolean {
  return deckCount >= maxDecks;
}

/** Kurzer Hinweis für ausgegraute Schaltflächen. */
export const DECK_LIMIT_LABEL = "Deck-Grenze erreicht";

export function deckLimitMessage(deckCount: number, maxDecks: number): string {
  return (
    `Du hast ${deckCount} von ${maxDecks} Decks. ` +
    "Jeder Scan legt ein neues Deck an — lösche zuerst ein Deck oder speichere " +
    "die Karten in ein bestehendes Deck."
  );
}

/**
 * Warnung, bevor Lernpunkte ausgegeben werden: Ist im Ziel-Deck kaum noch
 * Platz, soll die Nutzerin das vorher wissen und selbst entscheiden.
 * `null` bedeutet: genug Platz, keine Rückfrage nötig.
 */
export function nearlyFullWarning(
  freeSlots: number,
  action: "scannen" | "speichern" = "scannen"
): string | null {
  if (freeSlots <= 0) return null;
  if (freeSlots >= NEARLY_FULL_THRESHOLD) return null;
  return `In diesem Deck ist nur noch Platz für ${freeSlots} Karten. Trotzdem ${action}?`;
}

/** Beschriftung eines Decks in der Auswahl: „Biologie (12 Plätze frei)". */
export function deckSlotsLabel(title: string, freeSlots: number): string {
  if (freeSlots <= 0) return `${title} (voll)`;
  if (freeSlots < NEARLY_FULL_THRESHOLD) return `${title} (${freeSlots} Plätze frei)`;
  return title;
}

/**
 * Ehrliche Rückmeldung, wenn nicht alles gepasst hat:
 * „160 Karten erkannt, 12 gespeichert — Deck voll."
 */
export function savedSummary(generatedCount: number, savedCount: number): string {
  if (savedCount >= generatedCount) {
    return `${savedCount} Karten gespeichert.`;
  }
  return `${generatedCount} Karten erkannt, ${savedCount} gespeichert — Deck voll.`;
}

/**
 * Wählt `keep` Karten gleichmäßig über das GANZE Material statt der ersten
 * `keep` (Laras Entscheidung): Passt ein Kapitel nicht ganz ins Deck, bleibt es
 * trotzdem von vorn bis hinten abgedeckt, nur dünner. Spiegelt
 * `selectEvenlySpread` in apps/api/src/lib/importCapacity.ts.
 */
export function selectEvenlySpread<T>(items: T[], keep: number): T[] {
  if (keep <= 0) return [];
  if (keep >= items.length) return [...items];
  if (keep === 1) return [items[0]!];

  const step = (items.length - 1) / (keep - 1);
  const picked: T[] = [];
  for (let i = 0; i < keep; i += 1) {
    picked.push(items[Math.round(i * step)]!);
  }
  return picked;
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

/** Ablehnung wegen einer Tarifgrenze (409) — nicht wegen fehlender Lernpunkte. */
export function isPlanLimitError(error: unknown): boolean {
  const { status, code } = asErrorLike(error);
  return status === 409 || code === "DECK_FULL" || code === "DECK_LIMIT_REACHED";
}

/**
 * Darf das „Lernpunkte kaufen"-Fenster aufgehen? (#371)
 *
 * Vorher öffnete es sich bei JEDEM 402. Sobald Grenzen auch beim Import
 * greifen, hieße das: „Kauf Lernpunkte" für ein Problem, das kein Lernpunkt
 * löst. Grenz-Ablehnungen kommen deshalb als 409 (und werden hier zusätzlich
 * ausgeschlossen); ein 402 mit PAYWALL_REQUIRED ist ebenfalls eine Grenze und
 * kein leeres Konto.
 */
export function shouldOpenLpModal(error: unknown): boolean {
  if (isPlanLimitError(error)) return false;
  const { status, code } = asErrorLike(error);
  if (code === "INSUFFICIENT_LP") return true;
  if (code === "PAYWALL_REQUIRED") return false;
  return status === 402;
}
