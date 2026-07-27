// Baut aus dem rohen Kartentext das, was die Sprachausgabe wirklich sagen
// soll. Spiegelt die App (apps/mobile/src/lib/cardTerms.ts + cardMedia.ts):
// Bild-Verweise werden übersprungen, aus Übersetzungsfragen wird nur der
// eigentliche Begriff gesprochen, und eine Lückentext-Lücke wird auf der
// Vorderseite zur Pause statt die Lösung zu verraten.

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(https?:\/\/[^\s)]+\)/g;

export function stripMarkdownImages(text: string): string {
  return text.replace(MARKDOWN_IMAGE_REGEX, " ").replace(/\s+/g, " ").trim();
}

// Nur echte *Übersetzungs*-Fragen werden auf den zitierten Begriff verkürzt —
// der Text muss ein Übersetzungssignal tragen ("übersetze", eine Zielsprache).
// Sach- und Definitionsfragen ("Was bedeutet 'Legato'?") bleiben unverändert.
const TRANSLATION_SIGNAL =
  /übersetz|\bauf\s+(?:deutsch|latein|[a-zäöü]+isch)\b|\bins\s+(?:deutsche|[a-zäöü]+ische)\b/i;

// Gerade, deutsche, typografische und Guillemet-Anführungszeichen.
const QUOTES = "'\"„“”‘’«»";
const QUOTED_TERM = new RegExp("[" + QUOTES + "]([^" + QUOTES + "]{1,60})[" + QUOTES + "]");

export function cleanTerm(text: string): string {
  if (!text || !TRANSLATION_SIGNAL.test(text)) return text;
  const match = text.match(QUOTED_TERM);
  const term = match?.[1]?.trim();
  return term && term.length > 0 ? term : text;
}

const CLOZE_REGEX = /\{\{c\d+::(.+?)\}\}/;

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
  const cloze = cleanFront.match(CLOZE_REGEX);
  if (cloze) {
    return {
      front: cleanFront.replace(/\{\{c\d+::.+?\}\}/g, "…"),
      back: cloze[1] ?? cleanBack,
    };
  }
  return { front: cleanFront, back: cleanBack };
}
