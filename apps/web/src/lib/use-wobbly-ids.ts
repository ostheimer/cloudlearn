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
 *
 * `settled` wird wahr, sobald die Antwort da ist (auch bei Gratis-Tarif oder
 * Fehler). Der Setup-Merker (#610) wartet darauf: Eine gemerkte
 * „Wackelkandidaten"-Quelle darf erst vorbelegt werden, wenn feststeht, ob es
 * heute überhaupt welche gibt.
 */
export function useWobblyIds(deckId: string | undefined): {
  ids: Set<string>;
  settled: boolean;
} {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    let active = true;
    (async () => {
      // `settled` muss auf JEDEM Weg wahr werden — auch beim Gratis-Ausstieg —
      // sonst wartete der Setup-Merker (#610) für immer.
      try {
        let skipStats = false;
        try {
          const usage = await getLpBalance();
          // Nur ein KLARES "free" ueberspringt die Statistik.
          if (usage.tier === "free") skipStats = true;
        } catch {
          // Tarif unbekannt (Abfrage-Fehler): NICHT wie Free behandeln, sondern
          // die Statistik trotzdem versuchen — fuer Pro klappt sie, fuer echte
          // Free-Konten lehnt der Server sie gleich leise ab (#607).
        }
        if (!active || skipStats) return;
        try {
          const stats = await getDeckStats(deckId);
          if (active) setIds(new Set(stats.wobblyCards.map((w) => w.cardId)));
        } catch {
          /* Statistik ist Kür — ohne sie bleibt „Wackelkandidaten" einfach leer */
        }
      } finally {
        if (active) setSettled(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [deckId]);

  return { ids, settled };
}
