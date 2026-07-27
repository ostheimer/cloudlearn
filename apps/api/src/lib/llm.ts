import type { Flashcard } from "./contracts";
import { flashcardListSchema } from "./contracts";
import {
  generateFlashcardsFromText,
  generateFlashcardsFromImage,
  generateFlashcardsFromWebContent,
  type FlashcardGenerationResult,
  type UrlImageInput,
} from "./flashcardGenerator";

// Extended result including AI-generated deck title
export interface LLMGenerationResult {
  title: string;
  cards: Flashcard[];
  model: string;
  fallbackUsed: boolean;
}

const UNSUPPORTED_IMAGE_MARKUP_PATTERNS = [
  /!\[[^\]]*\]\([^)]*\)/i,
  /<img\b[^>]*>/i,
  /https?:\/\/[^\s)]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^\s)]*)?/i,
] as const;

const UNSUPPORTED_VISUAL_QUESTION_PATTERNS = [
  /\b(?:im|in der|auf dem|auf der)\s+(?:bild|abbildung|grafik|diagramm|foto|screenshot)\b/i,
  /\b(?:was|wer|welche(?:r|s|n)?)\b[^?!.]{0,60}\b(?:zeigt|zeigen)\s+(?:das|dieses|die|diese)\s+(?:bild|abbildung|grafik|diagramm|foto|screenshot)\b/i,
  /\b(?:welche(?:r|s|n)?\s+(?:struktur|komponente|element|objekt)|was)\s+(?:ist|wird)\s+(?:hier\s+)?(?:dargestellt|abgebildet|gezeigt)\s*\?/i,
  /\b(?:das|dieses)\s+(?:bild|diagramm|foto|screenshot)\s+(?:zeigt|stellt)\b/i,
  /\b(?:die|diese)\s+(?:abbildung|grafik)\s+(?:zeigt|stellt)\b/i,
  /\b(?:in|on)\s+(?:the|this|that)\s+(?:image|figure|diagram|photo|screenshot)\b/i,
  /\b(?:the|this|that)\s+(?:image|figure|diagram|photo|screenshot)\s+(?:shows?|depicts?)\b/i,
] as const;

const FALLBACK_BACK_MAX_LENGTH = 1_000;
const DECK_TITLE_MAX_LENGTH = 100;

/**
 * Generate flashcards from text with model fallback (sync)
 */
export function generateWithModelFallback(text: string, language: string): LLMGenerationResult {
  const fallback = generateFlashcardsFromTextSync(text, language);
  const cards = flashcardListSchema.parse(fallback.cards);
  return {
    title: fallback.title,
    cards,
    model: "heuristic-fallback",
    fallbackUsed: false,
  };
}

/**
 * Async: Generate flashcards from text via Gemini API
 */
export async function generateFlashcardsAsync(
  text: string,
  language: string
): Promise<LLMGenerationResult> {
  try {
    const result = await generateFlashcardsFromText(text, language);
    const cards = flashcardListSchema.parse(result.cards);
    return { title: result.title, cards, model: "gemini-3-flash", fallbackUsed: false };
  } catch {
    // Fallback to heuristic
    const fallback = generateFlashcardsFromTextSync(text, language);
    const cards = flashcardListSchema.parse(fallback.cards);
    return { title: fallback.title, cards, model: "heuristic-fallback", fallbackUsed: true };
  }
}

/**
 * Async: Generate flashcards from an image via Gemini Vision API
 */
export async function generateFlashcardsFromImageAsync(
  imageBase64: string,
  mimeType: string,
  language: string
): Promise<LLMGenerationResult> {
  const result = await generateFlashcardsFromImage(imageBase64, mimeType, language);
  const cards = flashcardListSchema.parse(result.cards);
  return { title: result.title, cards, model: "gemini-3-flash-vision", fallbackUsed: false };
}

/**
 * Async: Generate flashcards from webpage content (text + images)
 */
export async function generateFlashcardsFromUrlContentAsync(
  input: {
    sourceUrl: string;
    pageTitle: string;
    extractedText: string;
    images: UrlImageInput[];
  },
  language: string
): Promise<LLMGenerationResult> {
  const model = input.images.length > 0 ? "gemini-3-flash-vision" : "gemini-3-flash";
  try {
    const primary = await generateUrlCardsWithRetry(input, language);
    const parsedCards = flashcardListSchema.parse(primary.cards);
    const cards = dropUnsupportedImageCards(parsedCards);

    // Front and back are rendered as plain text. A Markdown image therefore
    // becomes raw code, while the associated question cannot be answered
    // without the missing visual (#534). If every generated card has this
    // problem, the extracted webpage text is safer than an empty preview.
    if (parsedCards.length > 0 && cards.length === 0) {
      console.warn("[llm] URL import returned only unsupported image-dependent cards");
      const fallback = generateFlashcardsFromTextSync(input.extractedText, language);
      return {
        title: fallback.title,
        cards: flashcardListSchema.parse(fallback.cards),
        model: "heuristic-fallback",
        fallbackUsed: true,
      };
    }

    return {
      title: clampDeckTitle(primary.title),
      cards,
      model,
      fallbackUsed: false,
    };
  } catch (primaryError) {
    if (primaryError instanceof Error) {
      console.warn(`[llm] URL import fallback after retries: ${primaryError.message}`);
    } else {
      console.warn("[llm] URL import fallback after retries");
    }

    const fallback = generateFlashcardsFromTextSync(input.extractedText, language);
    const cards = flashcardListSchema.parse(fallback.cards);
    return { title: fallback.title, cards, model: "heuristic-fallback", fallbackUsed: true };
  }
}

async function generateUrlCardsWithRetry(
  input: {
    sourceUrl: string;
    pageTitle: string;
    extractedText: string;
    images: UrlImageInput[];
  },
  language: string
): Promise<FlashcardGenerationResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await generateFlashcardsFromWebContent({
        sourceUrl: input.sourceUrl,
        pageTitle: input.pageTitle,
        textContent: input.extractedText,
        language,
        images: input.images,
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("URL import generation failed");
}

function dropUnsupportedImageCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter((card) => {
    const fullText = `${card.front ?? ""} ${card.back ?? ""}`;
    const hasImageMarkup = UNSUPPORTED_IMAGE_MARKUP_PATTERNS.some((pattern) =>
      pattern.test(fullText)
    );
    const hasVisualQuestion = UNSUPPORTED_VISUAL_QUESTION_PATTERNS.some((pattern) =>
      pattern.test(card.front ?? "")
    );
    return !hasImageMarkup && !hasVisualQuestion;
  });
}

/**
 * Synchronous heuristic fallback for text → flashcards
 */
function generateFlashcardsFromTextSync(text: string, language: string): FlashcardGenerationResult {
  const lines = text
    .split(/[.\n]/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 10);

  const safeLines = lines.length > 0 ? lines : [text.slice(0, 120)];

  const cards: Flashcard[] = safeLines.map((line, index) => {
    const prefix = language.startsWith("de")
      ? "Worum geht es in Aussage"
      : "What is the key point in statement";
    return {
      front: `${prefix} ${index + 1}?`,
      back: line.slice(0, FALLBACK_BACK_MAX_LENGTH),
      type: (index % 3 === 0 ? "cloze" : "basic") as "basic" | "cloze",
      difficulty: "medium" as const,
      tags: ["auto-generated", language],
    };
  });

  const titleWords = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
  const title = clampDeckTitle(
    titleWords.length > 0 ? titleWords.join(" ") : "Lernkarten"
  );

  return { title, cards };
}

function clampDeckTitle(title: string): string {
  return title.slice(0, DECK_TITLE_MAX_LENGTH);
}
