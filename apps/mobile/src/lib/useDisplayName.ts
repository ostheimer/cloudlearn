// Anzeigename best-effort fürs persönliche Lob auf den Ergebnis-Bildschirmen
// (Web-Gegenstück: die Begrüßung der Startseite, PR #476). Fehler bleiben
// still — ohne Namen zeigen die Aufrufer einfach ihren neutralen Text.
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
        // Netz-/Auth-Fehler: kein Lob mit Namen, mehr passiert nicht.
      });
    return () => {
      active = false;
    };
  }, []);

  return name;
}
