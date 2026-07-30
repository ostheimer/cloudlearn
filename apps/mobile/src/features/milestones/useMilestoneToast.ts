import { useCallback, useEffect, useRef, useState } from "react";
import { useUsageStore } from "../../store/usageStore";
import {
  isStreakMilestone,
  onMilestones,
  type MilestoneAward,
  type MilestoneKey,
} from "./milestoneBus";

export interface MilestoneToast {
  key: string;
  lpGranted: number;
  label: string;
}

export interface UseMilestoneToastReturn {
  toast: MilestoneToast | null;
  dismissToast: () => void;
  // Full-screen celebration for streak milestones (7/30/100); stays until tapped.
  celebration: MilestoneToast | null;
  dismissCelebration: () => void;
}

const TOAST_MS = 4000;

/**
 * Zeigt Meilenstein-Boni an, die der SERVER gutgeschrieben hat (#637).
 *
 * Früher löste dieser Hook die Boni selbst ein — und zwar nur dort, wo jemand
 * daran gedacht hatte, ihn aufzurufen: `first_review` im Karteikarten-Modus,
 * `first_deck` nirgends, im Web gar nichts. Jetzt löst der Server ein, sobald
 * ein Bonus entsteht, und dieser Hook hört nur noch zu.
 *
 * Die Punkte landen sofort im Kontostand (`addLp`), damit die LP-Pille nicht
 * eine Zahl ohne den gerade verkündeten Bonus zeigt. Kommt gleich danach eine
 * autoritative Zahl vom Server (die Lernsitzung setzt `lpBalance` aus der
 * earn-Antwort, die den Bonus bereits enthält), gewinnt diese — sie läuft
 * später, weil der Verteiler schon INNERHALB des fetch-Aufrufs feuert.
 */
export function useMilestoneToast(): UseMilestoneToastReturn {
  const [queue, setQueue] = useState<MilestoneAward[]>([]);
  const [celebration, setCelebration] = useState<MilestoneToast | null>(null);
  const addLp = useUsageStore((s) => s.addLp);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      onMilestones((awards) => {
        for (const award of awards) addLp(award.lpGranted);
        // Anhängen statt ersetzen: Wer mit einer Sitzung die erste Runde
        // abschliesst UND den 7-Tage-Streak knackt, soll beides sehen.
        setQueue((current) => [...current, ...awards]);
      }),
    [addLp],
  );

  const head = queue[0] ?? null;
  const headKey: MilestoneKey | null = head?.key ?? null;

  useEffect(() => {
    if (!head) return;

    if (isStreakMilestone(head.key)) {
      // Die grosse Feier bleibt stehen, bis sie angetippt wird — sie wird beim
      // Wegtippen aus der Schlange genommen (dismissCelebration).
      setCelebration({ key: head.key, lpGranted: head.lpGranted, label: head.key });
      return;
    }

    timerRef.current = setTimeout(() => setQueue((rest) => rest.slice(1)), TOAST_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Am Schlüssel hängen, nicht am Objekt: Eine neue Liste mit demselben
    // vordersten Bonus darf die laufende Anzeigedauer nicht neu starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headKey]);

  const advance = useCallback(() => setQueue((rest) => rest.slice(1)), []);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
    advance();
  }, [advance]);

  const toast: MilestoneToast | null =
    head && !isStreakMilestone(head.key)
      ? { key: head.key, lpGranted: head.lpGranted, label: head.key }
      : null;

  return { toast, dismissToast: advance, celebration, dismissCelebration };
}
