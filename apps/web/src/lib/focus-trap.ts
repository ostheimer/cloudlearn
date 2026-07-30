/**
 * Fokus-Falle für Dialoge (#613): Entscheidet, wohin der Fokus bei Tab bzw.
 * Shift+Tab springen muss, damit er den Dialog nie verlässt. Reine Logik —
 * das DOM-Stück (Elemente einsammeln, focus() aufrufen) liegt im Modal.
 *
 * Rückgabe: das Element, das den Fokus bekommen soll, oder null, wenn der
 * Browser den nächsten Schritt selbst richtig macht (Sprung INNERHALB der
 * Liste). `items` ist die Tab-Reihenfolge im Dialog, `active` das aktuell
 * fokussierte Element (null = Fokus steht außerhalb des Dialogs).
 */
export function trapTabTarget<T>(
  items: readonly T[],
  active: T | null,
  shiftKey: boolean
): T | null {
  if (items.length === 0) return null;
  const idx = active === null ? -1 : items.indexOf(active);
  if (shiftKey) {
    // Rückwärts vom ersten Element (oder von außerhalb) → ans Ende anknüpfen.
    if (idx <= 0) return items[items.length - 1] ?? null;
    return null;
  }
  // Vorwärts vom letzten Element (oder von außerhalb) → vorne anfangen.
  if (idx === -1 || idx === items.length - 1) return items[0] ?? null;
  return null;
}
