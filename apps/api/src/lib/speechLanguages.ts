/**
 * Die Sprachen, in denen Karten vorgelesen werden können.
 *
 * Warum es diese Liste gibt: Vor der Deck-Einstellung war die Stimme in App und
 * Web fest auf `de-DE` verdrahtet — französische Vokabeln wurden also mit
 * deutscher Aussprache vorgelesen. Beim Sprachenlernen ist das nicht nur schief,
 * sondern lehrt aktiv das Falsche.
 *
 * Die Liste ist serverseitig verbindlich: Jeder Schreibweg läuft durch
 * `speechLangSchema`, damit in der Spalte nie ein Code landet, für den es auf
 * keinem Gerät eine Stimme gibt. Neue Sprache heißt: hier eintragen, in den
 * beiden Clients die Beschriftung ergänzen — keine Migration nötig, weil die
 * Datenbank absichtlich keine Prüfliste führt.
 *
 * Aufgenommen sind lebende Sprachen, für die iOS und die gängigen Browser
 * Stimmen mitbringen. Ob eine bestimmte Stimme auf einem bestimmten Gerät
 * wirklich installiert ist, entscheidet das Gerät — fehlt sie, spricht die
 * Ausgabe in der Standardstimme weiter.
 *
 * Latein und Altgriechisch fehlen mit Absicht: Für tote Sprachen gibt es weder
 * auf iOS noch im Browser eine Stimme. Sie anzubieten hieße, einen Knopf zu
 * zeigen, der stumm bleibt oder in einer Zufallsstimme liest — schlimmer als
 * gar keine Auswahl.
 */
import { z } from "zod";

// Reihenfolge wie in den Clients: erst die fünf Schulsprachen, dann der Rest
// alphabetisch. Sie steht hier nur der Vergleichbarkeit halber — verbindlich ist
// für den Server allein, WELCHE Codes erlaubt sind.
export const SPEECH_LANGUAGES = [
  "de-DE",
  "en-US",
  "fr-FR",
  "es-ES",
  "it-IT",
  "ar-SA",
  "zh-CN",
  "da-DK",
  "fi-FI",
  "el-GR",
  "hi-IN",
  "ja-JP",
  "ko-KR",
  "hr-HR",
  "nl-NL",
  "nb-NO",
  "pl-PL",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sv-SE",
  "cs-CZ",
  "tr-TR",
  "hu-HU",
] as const;

export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number];

/** Was die Clients sprechen, solange am Deck nichts eingestellt ist. */
export const DEFAULT_SPEECH_LANGUAGE: SpeechLanguage = "de-DE";

/**
 * `null` ist ein gültiger Wert und heißt „Einstellung wieder entfernen".
 * `.optional()` obendrauf trennt das sauber von „Feld gar nicht mitgeschickt" —
 * ein PATCH ohne Sprachfeld darf die gespeicherte Sprache nicht anfassen.
 * Bewusst NICHT `.default(...).optional()`: diese Kombination hat in zod v4
 * schon einmal Kartendaten verschluckt (#355).
 */
export const speechLangSchema = z.enum(SPEECH_LANGUAGES).nullable().optional();
