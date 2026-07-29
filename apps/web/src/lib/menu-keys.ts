/**
 * Tastatur-Bedienung für die Optionsmenüs (#613): Pfeiltasten wandern mit
 * Umlauf durch die Einträge, Home/End springen an Anfang/Ende, Escape
 * schließt und gibt den Fokus an den Auslöser-Knopf zurück. Die Sprung-
 * Logik ist pur und getestet; handleMenuKey übernimmt das DOM-Stück für
 * das eine, gerade offene Menü.
 */
export function menuArrowTarget<T>(
  items: readonly T[],
  active: T | null,
  dir: 1 | -1
): T | null {
  if (items.length === 0) return null;
  const idx = active === null ? -1 : items.indexOf(active);
  // Fokus steht noch außerhalb (auf dem Auslöser): Pfeil runter beginnt
  // vorn, Pfeil hoch hinten — wie bei nativen Menüs.
  if (idx === -1) return (dir === 1 ? items[0] : items[items.length - 1]) ?? null;
  return items[(idx + dir + items.length) % items.length] ?? null;
}

/**
 * Ein Tastendruck bei offenem Optionsmenü. Es ist immer höchstens ein Menü
 * offen (openMenu-State der Seite), deshalb reicht die Suche im Dokument.
 * `close` schließt das Menü im React-State.
 */
export function handleMenuKey(e: KeyboardEvent, close: () => void): void {
  const menu = document.querySelector<HTMLElement>('.pop [role="menu"]');
  if (!menu) return;
  if (e.key === "Escape") {
    e.preventDefault();
    const trigger = menu
      .closest(".pop")
      ?.querySelector<HTMLElement>('[aria-expanded="true"]');
    close();
    trigger?.focus();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") {
    return;
  }
  const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const active =
    document.activeElement instanceof HTMLElement && menu.contains(document.activeElement)
      ? document.activeElement
      : null;
  const target =
    e.key === "Home"
      ? (items[0] ?? null)
      : e.key === "End"
        ? (items[items.length - 1] ?? null)
        : menuArrowTarget(items, active, e.key === "ArrowDown" ? 1 : -1);
  if (target) {
    e.preventDefault();
    target.focus();
  }
}
