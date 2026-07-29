"use client";

import { useEffect, useState } from "react";
import { getDeckStats, getLpBalance } from "@/lib/api";

/**
 * Die IDs der „Wackelkandidaten" eines Decks (am häufigsten falsch beantwortet)
 * für die Kartenquelle-Auswahl (#523). Best effort: Ohne Statistik bleibt die
 * Menge leer — „Nur Wackelkandidaten" ist dann ausgegraut, statt den Modus zu
 * blockieren.
 *
 * Die Einzel-Deck-Statistik ist Pro-only. Für Gratis-Konten würde der Aufruf
 * nur einen 403-Konsolenfehler und eine leere Liste liefern (#521 hat solche
 * Fehler gerade beseitigt). Darum zuerst den Tarif prüfen — der ist nicht
 * gesperrt — und die Statistik nur bei Pro/Lifetime holen.
 */
export function useWobblyIds(deckId: string | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!deckId) return;
    let active = true;
    (async () => {
      try {
        const usage = await getLpBalance();
        // Nur ein KLARES "free" ueberspringt die Statistik.
        if (!active || usage.tier === "free") return;
      } catch {
        // Tarif unbekannt (Abfrage-Fehler): NICHT wie Free behandeln, sondern
        // die Statistik trotzdem versuchen — fuer Pro klappt sie, fuer echte
        // Free-Konten lehnt der Server sie gleich leise ab (#607).
      }
      try {
        const stats = await getDeckStats(deckId);
        if (active) setIds(new Set(stats.wobblyCards.map((w) => w.cardId)));
      } catch {
        /* Statistik ist Kür — ohne sie bleibt „Wackelkandidaten" einfach leer */
      }
    })();
    return () => {
      active = false;
    };
  }, [deckId]);

  return ids;
}
