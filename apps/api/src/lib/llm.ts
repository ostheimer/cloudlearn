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

const UNSUPPORTED_MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\([^)]*\)/i;

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
      title: primary.title,
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
  return cards.filter(
    (card) =>
      !UNSUPPORTED_MARKDOWN_IMAGE_REGEX.test(`${card.front ?? ""} ${card.back ?? ""}`)
  );
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
      back: line,
      type: (index % 3 === 0 ? "cloze" : "basic") as "basic" | "cloze",
      difficulty: "medium" as const,
      tags: ["auto-generated", language],
    };
  });

  const titleWords = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
  const title = titleWords.length > 0 ? titleWords.join(" ") : "Lernkarten";

  return { title, cards };
}
