"use client";

// Anzeigename best-effort für persönliche Begrüßung/Lob (Home, Ergebnis-
// Bildschirme). Fehler bleiben still — ohne Namen zeigen die Aufrufer ihren
// neutralen Text. Mobile-Gegenstück: apps/mobile/src/lib/useDisplayName.ts.
import { useEffect, useState } from "react";
import { getProfile } from "./api";

export function useDisplayName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((p) => {
        if (active) setName(p.displayName);
      })
      .catch(() => {
        // Netz-/Auth-Fehler: kein Name, mehr passiert nicht.
      });
    return () => {
      active = false;
    };
  }, []);

  return name;
}
