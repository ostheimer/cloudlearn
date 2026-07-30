/**
 * Die Tarif-Grenzen (20 Decks, 150 Karten pro Deck …) — EINMAL je Sitzung
 * geholt, danach aus dem Gedächtnis (#611).
 *
 * Warum überhaupt ein Zwischenspeicher: Der Füllstand („142 von 150 Karten")
 * soll im Deck-Kopf stehen, und die Deck-Seite wird oft geöffnet. Ein Abruf bei
 * JEDEM Öffnen war der Grund, aus dem #376 auf der Deck-Seite jede Tarif-Abfrage
 * verboten hat. Ein Wert, der sich pro Sitzung nicht ändert, muss aber auch nur
 * einmal geholt werden — damit bleibt der Einwand von #376 erfüllt.
 *
 * Wichtig: Hier wird NUR nach `limits` gefragt, nie nach dem Tarif. Das
 * Pro-Schild am Occlusion-Eintrag bleibt statisch (#376/#364) — es darf
 * niemanden sperren, und diese Datei gibt ihm auch nichts, womit es das könnte.
 *
 * `null` heißt „unbekannt": älterer Server ohne `limits` oder eine
 * fehlgeschlagene Abfrage. Unbekannte Grenzen sperren NICHTS und behaupten
 * nichts (#603) — der Server lehnt notfalls ab, und seit #611 erklärt er dabei
 * auch, warum.
 */
import { getLpBalance } from "@/lib/api";

export interface PlanLimitsSnapshot {
  maxDecks: number | undefined;
  maxCardsPerDeck: number | undefined;
}

const UNKNOWN: PlanLimitsSnapshot = { maxDecks: undefined, maxCardsPerDeck: undefined };

let cached: PlanLimitsSnapshot | null = null;
let inFlight: Promise<PlanLimitsSnapshot> | null = null;

/**
 * Holt die Grenzen — beim ersten Aufruf über das Netz, danach sofort aus dem
 * Zwischenspeicher. Parallele Aufrufer (Bibliothek und Deck-Seite gleichzeitig)
 * teilen sich dieselbe laufende Anfrage.
 *
 * Wirft nie: Ein Fehlschlag liefert „unbekannt" und wird NICHT gespeichert, ein
 * späterer Aufruf darf es also erneut versuchen.
 */
export async function loadPlanLimits(): Promise<PlanLimitsSnapshot> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = getLpBalance()
    .then((usage) => {
      const snapshot: PlanLimitsSnapshot = {
        maxDecks: usage.limits?.maxDecks,
        maxCardsPerDeck: usage.limits?.maxCardsPerDeck,
      };
      // Nur echte Grenzen behalten. Kam nichts mit, bleibt die Tür für einen
      // zweiten Versuch offen, statt „unbekannt" für die ganze Sitzung
      // festzuschreiben.
      if (usage.limits) cached = snapshot;
      return snapshot;
    })
    .catch(() => UNKNOWN)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Nur für Tests: den Zwischenspeicher leeren. */
export function resetPlanLimitsCache(): void {
  cached = null;
  inFlight = null;
}
