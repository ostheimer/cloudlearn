/**
 * Meilenstein-Boni (#637).
 *
 * Der Server löst die einmaligen Boni selbst ein, sobald sie entstehen — beim
 * Anlegen eines Decks und am Ende einer Lernsitzung — und hängt das Ergebnis an
 * die Antwort des auslösenden Aufrufs. Vorher musste jeder Bildschirm von sich
 * aus nachfragen; die App tat das nur für `first_review` im Karteikarten-Modus,
 * `first_deck` nirgends.
 *
 * Diese Verteilstelle sitzt zwischen dem fetch-Wrapper (`lib/api.ts`) und der
 * Anzeige. Absichtlich ohne React: Der Auslöser ist ein Netzaufruf, kein
 * Bildschirm. Dasselbe Muster wie `registerPaywallTrigger` daneben.
 */

export const MILESTONE_KEYS = [
  "first_deck",
  "first_review",
  "streak_7",
  "streak_30",
  "streak_100",
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

export interface MilestoneAward {
  key: MilestoneKey;
  lpGranted: number;
}

/** Streak-Stufen bekommen die grosse Feier, die kleinen Boni einen Toast. */
export function isStreakMilestone(key: MilestoneKey): boolean {
  return key.startsWith("streak_");
}

function isMilestoneKey(value: unknown): value is MilestoneKey {
  return typeof value === "string" && (MILESTONE_KEYS as readonly string[]).includes(value);
}

/**
 * Fischt die Boni aus einer beliebigen API-Antwort.
 *
 * Misstrauisch, weil der Aufrufer JEDE Antwort sieht: Ein unbekannter
 * Schlüssel (neuerer Server, ältere App) wird übergangen statt als Toast ohne
 * Text zu erscheinen, und 0 Punkte sind kein Bonus.
 */
export function parseMilestones(payload: unknown): MilestoneAward[] {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as { milestones?: unknown }).milestones;
  if (!Array.isArray(raw)) return [];

  const awards: MilestoneAward[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { key, lpGranted } = entry as { key?: unknown; lpGranted?: unknown };
    if (!isMilestoneKey(key)) continue;
    if (typeof lpGranted !== "number" || !Number.isFinite(lpGranted) || lpGranted <= 0) continue;
    awards.push({ key, lpGranted });
  }
  return awards;
}

type MilestoneListener = (awards: MilestoneAward[]) => void;

const listeners = new Set<MilestoneListener>();

/** Meldet sich für Bonus-Hinweise an; die Rückgabe meldet wieder ab. */
export function onMilestones(listener: MilestoneListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Verteilt frisch gutgeschriebene Boni. Ohne Zuhörer passiert nichts — die
 * Punkte liegen trotzdem auf dem Konto, nur der Hinweis entfällt. Ein Fehler in
 * einem Zuhörer darf den Netzaufruf nicht mitreissen, der ihn ausgelöst hat.
 */
export function emitMilestones(awards: MilestoneAward[]): void {
  if (awards.length === 0) return;
  for (const listener of listeners) {
    try {
      listener(awards);
    } catch {
      /* Ein Hinweis ist Zugabe, kein Grund, den Aufruf scheitern zu lassen. */
    }
  }
}
