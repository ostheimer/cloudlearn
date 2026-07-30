import { updateCard } from "@/lib/api";

/**
 * Stern einer Karte optimistisch umschalten — sofort sichtbar, bei
 * Serverfehler zurückgenommen. Geteilte Logik für Karteikarten, Lückentext,
 * Quiz und Prüfung (#610): jeder Bildschirm hält seinen eigenen
 * `starredMap`-State, ruft aber dieselbe Umschalt-Funktion.
 */
export function toggleCardStar(
  cardId: string,
  starredMap: Record<string, boolean>,
  setStarredMap: (updater: (m: Record<string, boolean>) => Record<string, boolean>) => void
): void {
  const next = !(starredMap[cardId] ?? false);
  setStarredMap((m) => ({ ...m, [cardId]: next }));
  updateCard(cardId, { starred: next }).catch(() => {
    setStarredMap((m) => ({ ...m, [cardId]: !next }));
  });
}
