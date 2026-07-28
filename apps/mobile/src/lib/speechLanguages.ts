/**
 * Die Sprachen, in denen Karten vorgelesen werden können — Client-Gegenstück zu
 * `apps/api/src/lib/speechLanguages.ts`. Dieselbe Liste steht im Web
 * (`apps/web/src/lib/speech-languages.ts`).
 *
 * Warum: Vor der Deck-Einstellung war die Stimme fest auf `de-DE` verdrahtet —
 * französische Vokabeln wurden mit deutscher Aussprache vorgelesen. Beim
 * Sprachenlernen lehrt das aktiv das Falsche.
 *
 * Latein fehlt mit Absicht: Dafür gibt es auf iOS keine Stimme, der Knopf wäre
 * da und täte nichts.
 */

export const SPEECH_LANGUAGES = [
  { code: "de-DE", label: "Deutsch" },
  { code: "en-US", label: "Englisch" },
  { code: "fr-FR", label: "Französisch" },
  { code: "es-ES", label: "Spanisch" },
  { code: "it-IT", label: "Italienisch" },
] as const;

export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number]["code"];

/** Was gesprochen wird, solange am Deck nichts eingestellt ist. */
export const DEFAULT_SPEECH_LANGUAGE: SpeechLanguage = "de-DE";

/**
 * Macht aus dem gespeicherten Wert eine Sprache, die wir wirklich sprechen
 * können. Fängt drei Fälle in einem ab: nicht eingestellt (`null`), von einer
 * älteren App-Version nie mitgeliefert (`undefined`), und ein Code, den der
 * Server einmal kannte und dieser Client nicht. Ohne diesen Wächter würde die
 * Sprachausgabe bei einem unbekannten Code je nach Gerät schweigen oder in
 * einer Zufallsstimme sprechen.
 */
export function toSpeechLanguage(value: string | null | undefined): SpeechLanguage {
  const known = SPEECH_LANGUAGES.find((l) => l.code === value);
  return known ? known.code : DEFAULT_SPEECH_LANGUAGE;
}

/** Beschriftung für die Auswahl; unbekannte Codes zeigen die Standard-Sprache. */
export function speechLanguageLabel(value: string | null | undefined): string {
  const code = toSpeechLanguage(value);
  return SPEECH_LANGUAGES.find((l) => l.code === code)?.label ?? "Deutsch";
}
