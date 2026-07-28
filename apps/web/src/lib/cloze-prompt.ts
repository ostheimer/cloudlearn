// Baut die „Lücke zum Füllen" für den Lückentext-Modus — wie die App
// (apps/mobile/app/cloze.tsx), seit #569 mit der geteilten Aufbereitung aus
// card-display: Bild-Markdown wird herausgetrennt, Übersetzungs-Zusätze
// verschwinden. Reine Bild-Karten haben danach keinen Text mehr und fallen in
// hasTypeable heraus — ohne Bildanzeige wäre ihre Frage sinnlos.

import { cleanTerm, formatCloze, summarizeCardMedia } from "./card-display";

export type Parsed = { prompt: string; answer: string; isCloze: boolean };

// Aufbau je Kartenart:
//   - Cloze-Karten ({{cN::x}}): Satz mit Lücke zeigen, Antwort ist x
//     (die Lücke steckt fest im Text, Richtung ändert nichts)
//   - normale Karten: eine Seite zeigen, die andere tippen; `reverse` tauscht.
export function buildPrompt(
  card: { front: string; back: string },
  reverse: boolean
): Parsed {
  const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
  const parsed = formatCloze(media.plainFront);
  if (parsed.clozeAnswer !== null) {
    return {
      prompt: parsed.display,
      answer: parsed.clozeAnswer.trim(),
      isCloze: true,
    };
  }
  const front = cleanTerm(media.plainFront);
  const back = cleanTerm(media.plainBack);
  return reverse
    ? { prompt: back, answer: front, isCloze: false }
    : { prompt: front, answer: back, isCloze: false };
}

// Nutzbar, wenn man in der gewählten Richtung etwas eintippen kann.
export function hasTypeable(card: { front: string; back: string }): boolean {
  const parsed = buildPrompt(card, false);
  if (parsed.isCloze) return parsed.answer.length > 0;
  return parsed.prompt.length > 0 && parsed.answer.length > 0;
}
