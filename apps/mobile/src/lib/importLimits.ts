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

/**
 * Ab wie wenigen freien Plätzen die Zielauswahl die Platzzahl anzeigt. Die
 * WARNUNG hängt seit #570 nicht mehr an dieser Schwelle, sondern daran, ob die
 * neuen Karten wirklich alle passen (Laras Variante 3).
 */
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
 * `maxCardsPerDeck` ist `null`, solange der Server die Grenze nicht geliefert
 * hat (#603): Dann wird `null` zurückgegeben — nichts behauptet, nichts
 * gesperrt (wie `freeSlots` in apps/web/src/lib/import-limits.ts).
 */
export function freeCardSlots(deck: DeckLike, maxCardsPerDeck: number | null): number | null {
  if (typeof maxCardsPerDeck !== "number") return null;
  const used = (deck.cardCount ?? 0) + (deck.imageCardCount ?? 0);
  return Math.max(0, maxCardsPerDeck - used);
}

/**
 * `maxDecks` ist `null`, solange die Grenze unbekannt ist — dann wird NICHTS
 * gesperrt (#603): Lieber einmal zu wenig vorgewarnt als ein Pro-Konto mit den
 * Gratis-Werten ausgesperrt; der Server lehnt notfalls ab.
 */
export function isDeckLimitReached(deckCount: number, maxDecks: number | null): boolean {
  if (typeof maxDecks !== "number") return false;
  return deckCount >= maxDecks;
}

/** Kurzer Hinweis für ausgegraute Schaltflächen. */
export const DECK_LIMIT_LABEL = "Deck-Grenze erreicht";

/**
 * Wortgleich mit `deckLimitMessage` in apps/web/src/lib/import-limits.ts.
 *
 * Der frühere Satz „Jeder Scan legt ein neues Deck an" stimmt seit #453 nicht
 * mehr: Der Server speichert im Vorschau-Modus nichts, und beim Speichern kann
 * ein bestehendes Deck gewählt werden. An der Deck-Grenze ist nur der Weg
 * „Neues Deck" zu — der Hinweis nennt deshalb beide Auswege.
 */
export function deckLimitMessage(deckCount: number, maxDecks: number): string {
  return (
    `${deckCount} von ${maxDecks} Decks sind belegt. ` +
    "Neue Decks gehen erst wieder nach dem Löschen — " +
    "speichere die Karten so lange in ein bestehendes Deck."
  );
}

/**
 * Rückfrage vor dem Speichern (#570, Laras Variante 3): gewarnt wird genau
 * dann, wenn die neuen Karten NICHT mehr alle ins Ziel-Deck passen — nicht bei
 * einer festen Rest-Schwelle. Bei 27 freien Plätzen und 5 Karten kommt also
 * keine Frage mehr; bei 40 freien Plätzen und 60 Karten sehr wohl.
 * `null` bedeutet: alles passt, keine Rückfrage nötig. Ein volles Deck (0 frei)
 * hat seinen eigenen, härteren Dialog und liefert hier ebenfalls `null` —
 * genau wie eine unbekannte Grenze (`freeSlots === null`, #603).
 * Wortgleich mit `deckOverflowWarning` in apps/web/src/lib/import-limits.ts.
 */
export function deckOverflowWarning(freeSlots: number | null, cardCount: number): string | null {
  if (freeSlots === null || freeSlots <= 0) return null;
  if (cardCount <= freeSlots) return null;
  return (
    `Von deinen ${cardCount} Karten passen nur noch ${freeSlots} in dieses Deck — ` +
    "der Rest wird beim Speichern gleichmäßig über den ganzen Stoff weggelassen. " +
    "Trotzdem speichern?"
  );
}

/**
 * Beschriftung eines Decks in der Auswahl: „Biologie (12 Plätze frei)".
 * Bei unbekannter Grenze (`null`, #603) steht nur der Titel — wie
 * `deckOptionLabel` im Web.
 */
export function deckSlotsLabel(title: string, freeSlots: number | null): string {
  if (freeSlots === null) return title;
  if (freeSlots <= 0) return `${title} (voll)`;
  if (freeSlots === 1) return `${title} (1 Platz frei)`;
  if (freeSlots < NEARLY_FULL_THRESHOLD) return `${title} (${freeSlots} Plätze frei)`;
  return title;
}

/**
 * Platz-Hinweis für die Untertitel-Zeile des Scan-Ziel-Pickers (#612) — die
 * gleiche Staffel wie deckSlotsLabel, nur ohne den Titel davor: erst kurz vor
 * voll (NEARLY_FULL_THRESHOLD) gibt es überhaupt einen Hinweis, `null` heisst
 * „nichts anzeigen" (auch bei unbekannter Grenze, #603).
 */
export function deckSlotsHint(freeSlots: number | null): string | null {
  if (freeSlots === null) return null;
  if (freeSlots <= 0) return "voll — kein Platz mehr";
  if (freeSlots === 1) return "1 Platz frei";
  if (freeSlots < NEARLY_FULL_THRESHOLD) return `${freeSlots} Plätze frei`;
  return null;
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
 * Wie viele der `pendingCount` neuen Karten gespeichert werden dürfen (#603).
 *
 * Nur wenn BEIDES bekannt ist — der Kartenbestand des Ziel-Decks UND die echte
 * Server-Grenze — wird gerechnet. Fehlt eines, werden alle Karten
 * durchgelassen und der Server entscheidet: Die App darf niemals auf Basis
 * geratener Grenzen Karten wegwerfen (Pro-Konten verloren so still Karten,
 * „163 erkannt, 10 gespeichert").
 */
export function roomForNewCards(
  pendingCount: number,
  existingCount: number | null,
  maxCardsPerDeck: number | null
): number {
  if (existingCount === null || typeof maxCardsPerDeck !== "number") return pendingCount;
  return Math.min(pendingCount, Math.max(0, maxCardsPerDeck - existingCount));
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
  message?: string;
}

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error !== "object" || error === null) return {};
  const candidate = error as ErrorLike;
  return {
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate.message === "string" ? { message: candidate.message } : {}),
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

/**
 * Brauchbarer Server-Text — oder `null`, wenn nur ein Platzhalter ankam.
 *
 * `request()` in api.ts setzt „API error 409", wenn der Server gar keinen Text
 * mitschickt. Der darf niemals als Erklärung durchgereicht werden.
 */
function usableServerMessage(message: string | undefined): string | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  if (/^API error \d+$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Der Satz zu einer Grenz-Ablehnung AUSSERHALB des Imports — oder `null`, wenn
 * der Fehler keine Tarifgrenze ist (dann bleibt der Satz des Bildschirms).
 *
 * Genau der Helfer, den der Kommentar in `src/lib/api.ts` seit #371 versprach
 * („ob dort ein Kauf hilft, entscheidet der Bildschirm über adviceForLimit()")
 * und den nie jemand gebaut hat. Bis #611 fingen Duplizieren, Übernehmen und
 * Karte-von-Hand den Fehler blind ab: „Übernehmen fehlgeschlagen. Bitte versuch
 * es nochmal." forderte an der Deck-Grenze zu einer Endlosschleife auf.
 *
 * Die Tarif-Beratung leistet der Server längst selbst („Mit Pro hast du
 * deutlich mehr Platz." für Free, „lösche ein Deck, um Platz zu schaffen." für
 * Pro — `assertDeckLimit`/`assertCardLimit` in apps/api/src/lib/limits.ts). Der
 * Text wird deshalb durchgereicht statt neu erfunden: Er nennt die echten
 * Zahlen des Tarifs und ist auf Deutsch, weil der Server ihn bewusst für alte
 * App-Builds übersetzt liefert.
 *
 * Wichtig: Geprüft wird NUR der Code — anders als `isPlanLimitError`, das für
 * die Scan-Ansicht zusätzlich jeden 409 nimmt. Das ist dort zulässig, weil sie
 * ausschließlich Import-Endpunkte aufruft; Deck-Detail und geteiltes Deck rufen
 * viele andere auf, und 409 steht in dieser API auch für NO_INVITE,
 * ALREADY_REFERRED und den Streak-Schutz.
 */
export function adviceForLimit(error: unknown): string | null {
  const { code, message } = asErrorLike(error);
  if (code !== "DECK_LIMIT_REACHED" && code !== "DECK_FULL") return null;
  const fromServer = usableServerMessage(message);
  if (fromServer) return fromServer;
  // Nur für den Fall, dass der Server schweigt: ohne Zahlen, weil der Client
  // die Tarifgrenzen an dieser Stelle nicht zwingend kennt.
  return code === "DECK_LIMIT_REACHED"
    ? "Die Deck-Grenze deines Tarifs ist erreicht. Lösche ein Deck, um Platz zu schaffen."
    : "Dieses Deck ist voll. Leg für weitere Karten ein zweites Deck an.";
}
