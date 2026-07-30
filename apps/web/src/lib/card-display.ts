// Aufbereitung roher Kartentexte für die Anzeige — den App-Originalen
// nachgebaut (apps/mobile/src/lib/cardMedia.ts, cardTerms.ts und formatCloze
// aus learn.tsx), damit Web und App dieselbe Karte gleich zeigen: Bild-Markdown
// wird vom Text getrennt, Übersetzungs-Zusätze werden entfernt und die
// {{cN::…}}-Lücke wird zum Strich mit der Lösung als Rückseite. Auch das
// Vorlesen (speech-text.ts) bezieht seine Helfer von hier — eine Quelle,
// die nicht auseinanderlaufen kann (#569).

export interface MarkdownImage {
  alt: string;
  url: string;
  markdown: string;
  index: number;
}

export interface CardMediaSummary {
  plainFront: string;
  plainBack: string;
  frontImages: MarkdownImage[];
  backImages: MarkdownImage[];
  primaryImage: MarkdownImage | null;
  preferredLabel: string;
}

const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

export function parseMarkdownImages(text: string): MarkdownImage[] {
  const images: MarkdownImage[] = [];
  let match = MARKDOWN_IMAGE_REGEX.exec(text);
  while (match) {
    images.push({
      alt: (match[1] ?? "").trim(),
      url: (match[2] ?? "").trim(),
      markdown: match[0],
      index: match.index,
    });
    match = MARKDOWN_IMAGE_REGEX.exec(text);
  }
  MARKDOWN_IMAGE_REGEX.lastIndex = 0;
  return images;
}

export function stripMarkdownImages(text: string): string {
  return text
    .replace(MARKDOWN_IMAGE_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeCardMedia(card: {
  front: string;
  back: string;
}): CardMediaSummary {
  const frontImages = parseMarkdownImages(card.front);
  const backImages = parseMarkdownImages(card.back);
  const plainFront = stripMarkdownImages(card.front);
  const plainBack = stripMarkdownImages(card.back);
  const primaryImage = frontImages[0] ?? backImages[0] ?? null;
  const preferredLabel = plainBack || plainFront || primaryImage?.alt || "";

  return {
    plainFront,
    plainBack,
    frontImages,
    backImages,
    primaryImage,
    preferredLabel,
  };
}

/**
 * Vorschau-Texte einer Karte für Listen (#612).
 *
 * Die Kartenliste der Deck-Seite zeigte den ROHTEXT: `{{c1::Mitochondrium}}`
 * statt einer Lücke und `![](https://…/bild.png)` statt des Bildes — in den
 * Lernmodi wird beides längst aufbereitet (#591), nur die Liste bekam es nie.
 *
 * Die Lücke wird zum Strich (der rohe Code hätte die Lösung direkt neben der
 * Frage gedruckt); Bild-Markdown verschwindet, eine Seite aus nur einem Bild
 * fällt auf ihre Bildunterschrift zurück. `hasImage` sagt der Liste, dass an
 * dieser Karte ein Bild hängt, damit eine Seite ohne Unterschrift nicht als
 * leer erscheint.
 */
export function cardListPreview(card: { front: string; back: string }): {
  front: string;
  back: string;
  hasImage: boolean;
} {
  const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
  const front = formatCloze(media.plainFront).display || media.frontImages[0]?.alt || "";
  const back = formatCloze(media.plainBack).display || media.backImages[0]?.alt || "";
  return {
    front,
    back,
    hasImage: media.frontImages.length > 0 || media.backImages.length > 0,
  };
}

/**
 * Nachfrage vor dem Löschen einer Karte (#571).
 *
 * Wortgleich mit `cardDeleteQuestion` in apps/mobile/src/lib/cardDisplay.ts:
 * Laras Entscheidung war die Web-Satzform MIT dem zitierten Kartenanfang der
 * App — nur so sieht man, welche Karte gemeint ist.
 *
 * Der zweite Satz hieß bis zum Papierkorb (#614) „Das lässt sich nicht
 * rückgängig machen." Das ist seither falsch: gelöscht wird weich, und die
 * Karte liegt im Papierkorb. Der Satz musste weg, weil er von einem Weg
 * abgehalten hätte, den es gibt — beide Plattformen bleiben dabei wortgleich
 * (#571). In der App fehlt vorerst nur der Papierkorb-BILDSCHIRM (wartet auf
 * den nächsten Build); zurückholen kann man dieselbe Karte im Web sofort, es
 * ist dasselbe Konto.
 *
 * Der Anfang kommt aus der aufbereiteten Anzeige, nie aus dem Rohtext: sonst
 * stünde bei Bild- und Lückenkarten ![…](…) bzw. {{c1::…}} in der Nachfrage.
 * Bleibt nichts Lesbares übrig (reines Bild ohne Bildunterschrift), fragen wir
 * ohne Zitat.
 */
export const CARD_QUOTE_MAX = 50;

export function cardDeleteQuestion(card: { front: string; back: string }): string {
  const { front } = cardListPreview(card);
  const text = front.trim();
  if (!text) return "Soll diese Karte wirklich gelöscht werden? Sie landet im Papierkorb und lässt sich von dort zurückholen.";
  const quote = text.length > CARD_QUOTE_MAX ? `${text.slice(0, CARD_QUOTE_MAX).trimEnd()}…` : text;
  return `Soll „${quote}" wirklich gelöscht werden? Sie landet im Papierkorb und lässt sich von dort zurückholen.`;
}

// Zieht aus einer Übersetzungsfrage den bloßen Begriff heraus, damit gescannte
// Vokabelkarten in jedem Lernmodus als saubere Paare auftreten
// (le record <-> der Rekord).
//
// Greift nur bei echten *Übersetzungs*-Fragen — der Text muss einen zitierten
// Begriff UND ein Übersetzungssignal tragen ("übersetze" oder eine Zielsprache
// wie "auf Deutsch" / "auf Französisch" / "ins Deutsche"). Echte Sach- und
// Definitionsfragen ("Was ist ein Intervall?", "Was bedeutet 'Legato'?" ohne
// Zielsprache) bleiben unverändert.

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

/**
 * Übersetzt eine {{cN::…}}-Lücke fürs Anzeigen: Jede Lücke wird zum `blank`
 * (Standard "______"; das Vorlesen nutzt "…", damit die Stimme eine Pause
 * macht statt die Lösung zu verraten), `clozeAnswer` ist die Lösung der ersten
 * Lücke. Text ohne Lücke kommt unverändert zurück.
 */
export function formatCloze(
  text: string,
  blank = "______"
): { display: string; clozeAnswer: string | null } {
  const match = text.match(/\{\{c\d+::(.+?)\}\}/);
  if (!match) return { display: text, clozeAnswer: null };
  const clozeAnswer = match[1] ?? null;
  const display = text.replace(/\{\{c\d+::.+?\}\}/g, blank);
  return { display, clozeAnswer };
}
