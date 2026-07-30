"use client";

import { useEffect, useRef } from "react";

/**
 * Lädt Daten nach, sobald der Tab wieder in den Vordergrund kommt (#610).
 *
 * Das Web hatte bis dahin keinen einzigen Horcher darauf: Wer am Handy lernte
 * und danach zum offenen Laptop-Tab zurückkehrte, sah dort weiter die Zahlen
 * von vorhin — Streak, Tagesziel und „N fällig" stimmten erst nach einem
 * manuellen Neuladen. Das App-Gegenstück ist useFocusEffect.
 *
 * Zwei Ereignisse, weil sie verschiedene Fälle abdecken: `visibilitychange`
 * meldet den Tab-Wechsel innerhalb des Browsers, `focus` das Zurückkommen aus
 * einem anderen Programm (der Browser bleibt dabei durchgehend sichtbar).
 *
 * Die Bremse verhindert, dass Hin- und Herklicken zwischen zwei Fenstern eine
 * Anfrage nach der anderen auslöst. Sie startet „abgelaufen", damit die erste
 * Rückkehr sofort nachlädt statt erst nach Ablauf des Fensters.
 */
export function useRefreshOnFocus(
  refresh: () => void,
  { minIntervalMs = 30_000, enabled = true }: { minIntervalMs?: number; enabled?: boolean } = {}
): void {
  // Über einen Ref, damit ein bei jedem Render neu gebautes `refresh` die
  // Horcher nicht ständig ab- und wieder anmeldet.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const maybeRefresh = () => {
      // Beim `focus`-Ereignis ist der Tab immer sichtbar; beim
      // `visibilitychange` nur in der Richtung, die uns interessiert.
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      refreshRef.current();
    };

    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [minIntervalMs, enabled]);
}
