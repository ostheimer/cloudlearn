/**
 * Meilenstein-Boni (#637).
 *
 * Der Server löst diese einmaligen Boni selbst ein, sobald sie entstehen, und
 * hängt das Ergebnis an die Antwort des auslösenden Aufrufs. Hier steht, wie
 * das Web damit umgeht: eine Liste erkennen, eine Beschriftung dazu finden und
 * genau einmal einen Hinweis auslösen.
 *
 * Warum eine eigene kleine Verteilstelle statt eines React-Contexts: Der
 * Auslöser sitzt im fetch-Wrapper (`lib/api.ts`), also ausserhalb von React.
 * Eine Stelle statt einer je Bildschirm ist auch der Kern der Reparatur — die
 * alte Lösung verlangte, dass jeder Bildschirm von sich aus nachfragt, und
 * genau das hat das Web nirgends getan.
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

/**
 * Beschriftungen — WORTGLEICH mit der Liste auf der Lernpunkte-Seite
 * (`app/dashboard/lp/page.tsx`). Wer dort „Erstes Deck" gelesen hat, soll im
 * Hinweis dasselbe wiederfinden; zwei Formulierungen für denselben Bonus
 * lassen ihn wie zwei verschiedene aussehen.
 */
const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  first_deck: "Erstes Deck",
  first_review: "Erste Lernsitzung",
  streak_7: "7 Tage",
  streak_30: "30 Tage",
  streak_100: "100 Tage",
};

export function milestoneLabel(key: MilestoneKey): string {
  return MILESTONE_LABELS[key];
}

function isMilestoneKey(value: unknown): value is MilestoneKey {
  return typeof value === "string" && (MILESTONE_KEYS as readonly string[]).includes(value);
}

/**
 * Fischt die Meilensteine aus einer beliebigen API-Antwort.
 *
 * Absichtlich misstrauisch: Der Aufrufer ist der gemeinsame fetch-Wrapper und
 * bekommt JEDE Antwort zu sehen, auch die ohne Meilensteine. Ein unbekannter
 * Schlüssel (ein Server, der einen Bonus kennt, den dieses Web noch nicht
 * kennt) wird übergangen statt als leeres Kästchen angezeigt, und 0 Punkte
 * gelten nicht als Bonus — der Server meldet ohnehin nur, was wirklich floss.
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
 * Verteilt frisch gutgeschriebene Boni. Ohne Zuhörer passiert nichts — der
 * Bonus liegt trotzdem auf dem Konto, nur der Hinweis entfällt. Ein Fehler in
 * einem Zuhörer darf den API-Aufruf nicht mitreissen, der ihn ausgelöst hat.
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
