/**
 * Die Sprachen, in denen Karten vorgelesen werden können.
 *
 * Warum es diese Liste gibt: Vor der Deck-Einstellung war die Stimme in App und
 * Web fest auf `de-DE` verdrahtet — französische Vokabeln wurden also mit
 * deutscher Aussprache vorgelesen. Beim Sprachenlernen ist das nicht nur schief,
 * sondern lehrt aktiv das Falsche.
 *
 * Die Liste ist bewusst kurz und serverseitig verbindlich: Jeder Schreibweg
 * läuft durch `speechLangSchema`, damit in der Spalte nie ein Code landet, für
 * den es auf keinem Gerät eine Stimme gibt. Neue Sprache heißt: hier eintragen,
 * in den beiden Clients die Beschriftung ergänzen — keine Migration nötig, weil
 * die Datenbank absichtlich keine Prüfliste führt.
 *
 * Latein fehlt mit Absicht: Weder iOS noch die gängigen Browser bringen dafür
 * eine Stimme mit. Der Knopf wäre da und täte nichts — schlimmer als gar keine
 * Auswahl.
 */
import { z } from "zod";

export const SPEECH_LANGUAGES = ["de-DE", "en-US", "fr-FR", "es-ES", "it-IT"] as const;

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
