import type { Flashcard } from "./contracts";
import { flashcardListSchema } from "./contracts";
import { generateFlashcardsFromText, generateFlashcardsFromImage, type FlashcardGenerationResult } from "./flashcardGenerator";

// Extended result including AI-generated deck title
export interface LLMGenerationResult {
  title: string;
  cards: Flashcard[];
  model: string;
  fallbackUsed: boolean;
}

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
