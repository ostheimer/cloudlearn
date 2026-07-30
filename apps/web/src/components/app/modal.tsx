"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { trapTabTarget } from "@/lib/focus-trap";

// Alles, was per Tab erreichbar ist; unsichtbare Treffer (display:none,
// type="hidden") fallen unten über den offsetParent-Filter raus.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tastatur-Verhalten für Dialoge (#613): Tab bleibt im Dialog gefangen, der
 * Startfokus landet auf dem ersten Bedienelement (ein autoFocus-Kind hat
 * Vorrang), und beim Schließen kehrt der Fokus zum auslösenden Knopf zurück.
 * `active` erlaubt Dialogen, die dauerhaft gemountet sind und nur ein- und
 * ausblenden (DisplayNamePrompt), das Verhalten erst beim Öffnen zu starten.
 */
export function useDialogFocus(
  boxRef: RefObject<HTMLElement | null>,
  active: boolean = true
) {
  useEffect(() => {
    if (!active) return;
    const box = boxRef.current;
    if (!box) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );

    // Startfokus — außer ein Kind (autoFocus) hat ihn sich schon geholt.
    if (!box.contains(document.activeElement)) {
      (focusables()[0] ?? box).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        box.focus();
        return;
      }
      const current =
        document.activeElement instanceof HTMLElement &&
        box.contains(document.activeElement)
          ? document.activeElement
          : null;
      const target = trapTabTarget(items, current, e.shiftKey);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    };
    // capture, damit die Falle auch greift, wenn ein Kind das Ereignis schluckt.
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Der Auslöser kann inzwischen verschwunden sein (z. B. Deck gelöscht).
      if (opener?.isConnected) opener.focus();
    };
  }, [boxRef, active]);
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useDialogFocus(boxRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* tabIndex -1: Auffang-Fokus für Dialoge ganz ohne Bedienelemente. */}
      <div
        ref={boxRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <h3 className="h3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
