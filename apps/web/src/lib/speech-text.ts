// Baut aus dem rohen Kartentext das, was die Sprachausgabe wirklich sagen
// soll. Die Aufbereitung selbst (Bild-Markdown, Übersetzungs-Zusätze, Lücke)
// lebt seit #569 in card-display.ts und wird von Anzeige UND Vorlesen geteilt —
// hier bleibt nur die Vorlese-Besonderheit: Die Lücke wird zur Sprech-Pause
// ("…") statt zum Strich, damit die Stimme die Lösung nicht verrät.

import { cleanTerm, formatCloze, stripMarkdownImages } from "./card-display";

// Bestehende Aufrufer und Tests beziehen die geteilten Helfer weiter von hier.
export { cleanTerm, stripMarkdownImages } from "./card-display";

/**
 * Sprech-Texte für beide Kartenseiten. Bei einer Lückentext-Vorderseite wird
 * die Lücke als "…" gesprochen (die Stimme macht eine Pause) und die Rückseite
 * ist die Lösung der ersten Lücke — wie die Anzeige der App. Eine reine
 * Bildkarte ergibt leere Texte; der Aufrufer spricht dann schlicht nichts,
 * statt eine Bild-URL vorzulesen.
 */
export function speechTexts(front: string, back: string): { front: string; back: string } {
  const cleanFront = cleanTerm(stripMarkdownImages(front));
  const cleanBack = cleanTerm(stripMarkdownImages(back));
  const parsed = formatCloze(cleanFront, "…");
  if (parsed.clozeAnswer !== null) {
    return { front: parsed.display, back: parsed.clozeAnswer || cleanBack };
  }
  return { front: cleanFront, back: cleanBack };
}
