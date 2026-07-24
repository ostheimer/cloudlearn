"use client";

import { useEffect, useState } from "react";

/**
 * Ist das Hauptzeigegerät ein Finger (grob) statt einer Maus (fein)?
 *
 * Für Texte, die die Geste benennen: am Handy „antippen", am Desktop
 * „anklicken"/„drüberfahren" (#521). Startet mit false, damit Server-Render
 * und erster Client-Render übereinstimmen; am Handy springt der Wert direkt
 * nach dem Einhängen um — wie beim „Foto aufnehmen"-Knopf der Scan-Seite.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setCoarse(window.matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  return coarse;
}
