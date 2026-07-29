/**
 * Die Sprachen, in denen Karten vorgelesen werden können — Web-Gegenstück zu
 * `apps/mobile/src/lib/speechLanguages.ts`. Verbindlich geprüft wird
 * serverseitig in `apps/api/src/lib/speechLanguages.ts`.
 *
 * Warum: Vor der Deck-Einstellung war die Stimme fest auf `de-DE` verdrahtet —
 * französische Vokabeln wurden mit deutscher Aussprache vorgelesen. Beim
 * Sprachenlernen lehrt das aktiv das Falsche.
 *
 * Latein fehlt mit Absicht: Dafür bringt kein gängiger Browser eine Stimme mit.
 */

// Erst die fünf Schulsprachen — die trifft es in fast allen Fällen und niemand
// soll dafür scrollen —, danach der Rest alphabetisch nach der deutschen
// Beschriftung. Dieselbe Reihenfolge steht in der App.
export const SPEECH_LANGUAGES = [
  { code: "de-DE", label: "Deutsch" },
  { code: "en-US", label: "Englisch" },
  { code: "fr-FR", label: "Französisch" },
  { code: "es-ES", label: "Spanisch" },
  { code: "it-IT", label: "Italienisch" },
  { code: "ar-SA", label: "Arabisch" },
  { code: "zh-CN", label: "Chinesisch" },
  { code: "da-DK", label: "Dänisch" },
  { code: "fi-FI", label: "Finnisch" },
  { code: "el-GR", label: "Griechisch" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ja-JP", label: "Japanisch" },
  { code: "ko-KR", label: "Koreanisch" },
  { code: "hr-HR", label: "Kroatisch" },
  { code: "nl-NL", label: "Niederländisch" },
  { code: "nb-NO", label: "Norwegisch" },
  { code: "pl-PL", label: "Polnisch" },
  { code: "pt-PT", label: "Portugiesisch" },
  { code: "ro-RO", label: "Rumänisch" },
  { code: "ru-RU", label: "Russisch" },
  { code: "sv-SE", label: "Schwedisch" },
  { code: "cs-CZ", label: "Tschechisch" },
  { code: "tr-TR", label: "Türkisch" },
  { code: "hu-HU", label: "Ungarisch" },
] as const;

export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number]["code"];

/** Was gesprochen wird, solange am Deck nichts eingestellt ist. */
export const DEFAULT_SPEECH_LANGUAGE: SpeechLanguage = "de-DE";

/**
 * Macht aus dem gespeicherten Wert eine Sprache, die wir wirklich sprechen
 * können. Fängt drei Fälle in einem ab: nicht eingestellt (`null`), von einer
 * älteren API nie mitgeliefert (`undefined`), und ein Code, den der Server
 * einmal kannte und dieser Client nicht.
 */
export function toSpeechLanguage(value: string | null | undefined): SpeechLanguage {
  const known = SPEECH_LANGUAGES.find((l) => l.code === value);
  return known ? known.code : DEFAULT_SPEECH_LANGUAGE;
}
