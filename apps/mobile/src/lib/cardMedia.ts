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
