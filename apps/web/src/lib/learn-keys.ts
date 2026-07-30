/**
 * Tastensteuerung der Lernansicht (#610). Am Laptop lag bisher jede Bewertung
 * hinter einem Mausklick, obwohl die Hände beim Lernen ohnehin auf der
 * Tastatur liegen.
 *
 * Die Entscheidung steckt bewusst in einer reinen Funktion: Ob ein Tastendruck
 * bewerten darf, hängt an mehreren Bedingungen gleichzeitig — und genau da
 * entstehen die teuren Fehler (eine Karte bewerten, deren Antwort man nie
 * gesehen hat, oder eine Ziffer schlucken, die jemand in ein Textfeld tippt).
 */

export interface LearnKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Tag-Name des Elements, auf dem die Taste landete ("INPUT", "TEXTAREA", …). */
  targetTag?: string | undefined;
  /** Ob das Ziel ein frei beschreibbarer Bereich ist (contenteditable). */
  targetIsEditable?: boolean | undefined;
}

/** Reihenfolge der Bewertungs-Knöpfe: 1 = Nochmal, 2 = Schwer, 3 = Gut, 4 = Leicht. */
const RATING_KEYS = ["1", "2", "3", "4"];

/**
 * Index der Bewertung, die dieser Tastendruck auslösen soll — oder null, wenn
 * nichts passieren darf.
 *
 * `flipped` muss wahr sein: Vor dem Umdrehen kennt man die Antwort nicht, eine
 * Bewertung wäre geraten und würde die Wiederhol-Planung der Karte verstellen.
 */
export function ratingKeyIndex(event: LearnKeyEvent, flipped: boolean): number | null {
  // Tastenkürzel des Browsers (Strg/Cmd/Alt + Ziffer wechselt z. B. den Tab)
  // gehören nicht uns.
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  // Wer in ein Feld tippt, meint die Ziffer — nicht eine Bewertung. Die
  // Lernansicht selbst hat heute keins, aber ein später ergänztes Suchfeld
  // soll nicht still Karten bewerten.
  if (event.targetIsEditable) return null;
  const tag = event.targetTag?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return null;
  if (!flipped) return null;
  const index = RATING_KEYS.indexOf(event.key);
  return index === -1 ? null : index;
}

/**
 * Soll ein Enter am Fenster zur nächsten Karte blättern? (Lückentext, nur im
 * aufgedeckten Zustand — der Aufrufer hängt den Horcher gar nicht erst ein,
 * solange die Antwort noch offen ist.)
 *
 * Auf einem Knopf oder Link ist Enter dessen eigene Betätigung: Ein Enter auf
 * „Trotzdem als richtig zählen" soll die Antwort gelten lassen und NICHT
 * gleichzeitig weiterblättern.
 *
 * Nicht hier zu sehen, aber untrennbar dazugehörig: Das Enter, mit dem im
 * Eingabefeld geprüft wird, muss dort mit stopPropagation enden. Sonst schaltet
 * das Prüfen diesen Horcher im selben Wimpernschlag scharf, derselbe
 * Tastendruck erreicht das Fenster — und ein einziges Enter prüft UND blättert
 * weiter, sodass die Rückmeldung nie zu sehen ist.
 */
export function shouldAdvanceOnEnter(event: LearnKeyEvent): boolean {
  if (event.key !== "Enter") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const tag = event.targetTag?.toUpperCase();
  if (tag === "BUTTON" || tag === "A") return false;
  return true;
}
