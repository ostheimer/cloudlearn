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
 * Die Warnung „nur noch Platz für N Karten" konnte hier zunächst nie auslösen:
 * Im Browser gab es kein Ziel-Deck, jeder Import legte ein frisches an, und ein
 * frisches Deck hat alle Plätze frei. Mit der Deck-Auswahl (#427) ist sie
 * sinnvoll geworden und steht als `deckSpaceNotice` weiter unten.
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
 * Der Ton folgt seit #436 `planLimitMessage` unten: Zustand voran statt Anrede
 * („20 von 20 Decks sind belegt" statt „Du hast …"). Beide Zahlen bleiben
 * stehen, damit nachvollziehbar ist, woran die Grenze hängt.
 *
 * Der Satz „Im Browser legt jeder Scan ein neues Deck an" ist mit #427 falsch
 * geworden: Seit der Zielauswahl kann auch der Browser in ein bestehendes Deck
 * schreiben. An der Deck-Grenze ist der Import damit keine Sackgasse mehr — nur
 * „Neues Deck" fällt weg —, und der Hinweis nennt jetzt beide Auswege. Damit
 * entfällt auch der Unterschied zur App, der #436 zu der Einschränkung „im
 * Browser" gezwungen hatte.
 */
export function deckLimitMessage(deckCount: number, maxDecks: number): string {
  return (
    `${deckCount} von ${maxDecks} Decks sind belegt. ` +
    "Neue Decks gehen erst wieder nach dem Löschen — " +
    "speichere die Karten so lange in ein bestehendes Deck."
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

/**
 * Freie Kartenplätze eines Decks — oder `null`, wenn es sich nicht sagen lässt.
 *
 * `cardCount` und `maxCardsPerDeck` sind optional, weil beide fehlen können:
 * `cardCount` liefert nur die Deckliste (nicht jede Deck-Antwort),
 * `maxCardsPerDeck` erst ein Server ab #411. Fehlt eines, wird nichts behauptet
 * und nichts gewarnt.
 *
 * Bild-Karten zählen mit (#570): Der Server zählt beim Durchsetzen der Grenze
 * jede lebende Karte — ohne `imageCardCount` zeigte das Web bei Decks mit
 * Occlusion-Karten zu viel freien Platz an.
 */
export function freeSlots(
  cardCount: number | undefined,
  imageCardCount: number | undefined,
  maxCardsPerDeck: number | undefined
): number | null {
  if (typeof cardCount !== "number" || typeof maxCardsPerDeck !== "number") return null;
  return Math.max(0, maxCardsPerDeck - cardCount - (imageCardCount ?? 0));
}

/**
 * Füllstand der Bibliothek: „19 von 20 Decks belegt" — oder `null`, wenn nichts
 * zu sagen ist (#611).
 *
 * Die Grenze war bisher unsichtbar, bis man sie riss: Der Endpunkt liefert
 * `usage.limits` seit #411 mit, nur fragte keine Bibliothek sie ab. Wer beim
 * 20. Deck „Deck-Grenze erreicht" liest, hat vorher nie erfahren, dass es
 * überhaupt eine gibt.
 *
 * `null` bei unbekannter Grenze (älterer Server) und solange die Deckliste
 * lädt — dieselbe Zurückhaltung wie `deckLimitNotice`.
 *
 * Wortgleich mit `deckSlotsSummary` in apps/mobile/src/lib/importLimits.ts.
 */
export function deckSlotsSummary(
  deckCount: number | null,
  maxDecks: number | undefined
): string | null {
  if (deckCount === null || typeof maxDecks !== "number") return null;
  return `${deckCount} von ${maxDecks} Decks belegt`;
}

/** Beschriftung eines Decks in der Zielauswahl: „Datenbanken · 43 Plätze frei". */
export function deckOptionLabel(title: string, free: number | null): string {
  if (free === null) return title;
  if (free === 0) return `${title} · voll`;
  if (free === 1) return `${title} · 1 Platz frei`;
  return `${title} · ${free} Plätze frei`;
}

/**
 * Hinweis zum gewählten Ziel-Deck — oder `null`, wenn alles passt.
 *
 * Seit #570 (Laras Variante 3) hängt der Hinweis nicht mehr an einer festen
 * Rest-Schwelle, sondern daran, ob die neuen Karten wirklich alle passen: keine
 * falschen Alarme bei 27 freien Plätzen und 5 Karten, kein Schweigen bei 40
 * freien Plätzen und 60 Karten.
 *
 * Bewusst nur die Zahlen, ohne die Folge („der Rest wird … weggelassen"):
 * Die stand hier UND in der Rückfrage davor wortgleich doppelt (#595). Laras
 * Entscheidung 29.07.: der Kasten kündigt kurz an, die Rückfrage vor dem
 * Speichern erklärt — dort steht der volle Satz, wortgleich mit der App.
 */
export function deckSpaceNotice(free: number | null, cardCount: number): string | null {
  if (free === null) return null;
  if (free === 0) {
    return "Dieses Deck ist voll. Wähle ein anderes Deck oder lege ein neues an.";
  }
  if (cardCount > free) {
    return `Von deinen ${cardCount} Karten passen nur noch ${free} in dieses Deck.`;
  }
  return null;
}

/** Titel der Rückfrage vor dem Speichern — wortgleich mit dem App-Dialog. */
export const OVERFLOW_CONFIRM_TITLE = "Wenig Platz";

/**
 * Rückfrage vor dem Speichern (#570, Laras Variante 3) — `null`, wenn alles
 * passt. Wortgleich mit `deckOverflowWarning` in
 * apps/mobile/src/lib/importLimits.ts; seit #595 eigener Volltext statt aus
 * `deckSpaceNotice` zusammengesetzt, denn der Kasten ist jetzt kürzer als die
 * Rückfrage.
 */
export function deckOverflowWarning(free: number | null, cardCount: number): string | null {
  if (free === null || free === 0) return null;
  if (cardCount <= free) return null;
  return (
    `Von deinen ${cardCount} Karten passen nur noch ${free} in dieses Deck — ` +
    "der Rest wird beim Speichern gleichmäßig über den ganzen Stoff weggelassen. " +
    "Trotzdem speichern?"
  );
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
 * Der Satz zu einer Grenz-Ablehnung beim SPEICHERN — oder `null`, wenn es keine
 * ist.
 *
 * Bewusst EIGENER Text statt der Server-Meldung, aber aus einem anderen Grund
 * als früher: Die Seite kennt den Kontext (Vorschau, Karten noch nicht abgelegt,
 * kein Lernpunkt-Abzug beim Speichern) und kann deshalb genauer beruhigen als
 * die generische API-Meldung.
 *
 * Erreichbar bleibt die Grenze trotz vorheriger Prüfung: Die Deckliste kann
 * veraltet sein (zweiter Tab, zweites Gerät), und der Server hält sie auch beim
 * Schreiben.
 */
export function planLimitMessage(error: unknown): string | null {
  const { code } = asErrorLike(error);
  // Beide Fälle treten seit #427/#445 erst beim SPEICHERN der Vorschau auf. Zwei
  // Dinge sind dadurch anders als im alten Wortlaut: Es gibt jetzt einen zweiten
  // Ausweg (ein bestehendes Deck), und das Speichern kostet keine Lernpunkte —
  // die flossen beim Erzeugen. Es wird hier also nichts „zurückgebucht", und die
  // Karten sind nicht verloren: Sie stehen weiter in der Vorschau.
  if (code === "DECK_LIMIT_REACHED") {
    return (
      "Die Deck-Grenze deines Tarifs ist erreicht. Lösche ein Deck in der " +
      "Bibliothek — oder speichere die Karten in ein bestehendes Deck. Sie " +
      "bleiben so lange in der Vorschau."
    );
  }
  if (code === "DECK_FULL") {
    return (
      "In dieses Deck passt keine weitere Karte. Wähle ein anderes Deck oder " +
      "lege ein neues an — deine Karten bleiben so lange in der Vorschau."
    );
  }
  return null;
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
 * Diesen Helfer versprach der Kommentar in `apps/mobile/src/lib/api.ts` seit
 * #371 („ob dort ein Kauf hilft, entscheidet der Bildschirm über
 * adviceForLimit()"); gebaut wurde er nie. Bis #611 fingen Deck-anlegen,
 * Duplizieren, Übernehmen und Karte-von-Hand den Fehler deshalb blind ab und
 * zeigten „Bitte versuche es erneut" — eine Aufforderung zu etwas, das
 * garantiert wieder scheitert.
 *
 * Die Tarif-Beratung muss er nicht selbst leisten: Der Server hängt sie längst
 * an die Meldung („Mit Pro hast du deutlich mehr Platz." für Free,
 * „lösche ein Deck, um Platz zu schaffen." für Pro, `assertDeckLimit` in
 * apps/api/src/lib/limits.ts). Sie ging nur unterwegs verloren.
 *
 * Anders als `planLimitMessage` (Import) wird deshalb der SERVER-Text
 * durchgereicht: Er nennt die echten Zahlen des Tarifs, und außerhalb des
 * Imports gibt es keine Vorschau, in der Karten liegen bleiben könnten — die
 * Import-Sätze („bleiben so lange in der Vorschau", „zurückgebucht") wären hier
 * schlicht falsch.
 *
 * Geprüft wird nur der CODE, nie der Status: 409 steht in dieser API auch für
 * NO_INVITE, ALREADY_REFERRED und den Streak-Schutz. Anders als beim Import
 * (`isPlanLimitError` der App) rufen diese Bildschirme viele verschiedene
 * Endpunkte auf — ein Statusvergleich gäbe fremde Konflikte als Tarifgrenze aus.
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
