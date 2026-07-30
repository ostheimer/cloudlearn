import { updateCard } from "./api";

/**
 * Toggle a card's star optimistically — visible immediately, rolled back on a
 * server error. Shared logic for Karteikarten, Lückentext, Quiz and Prüfung
 * (#610): every screen keeps its own `starredMap` state but calls the same
 * toggle function. Mirror of apps/web/src/lib/toggle-card-star.ts.
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
