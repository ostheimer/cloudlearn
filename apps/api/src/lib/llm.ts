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

const MIN_COMPONENT_IMAGE_QUESTIONS = 2;
const COMPONENT_IMAGE_QUESTION_REGEX =
  /(welche(?:s|r)?\s+(ui-)?komponente|welches\s+element|welches\s+pattern|wof(?:ü|u)r\s+wird.*(komponente|element)|which\s+(ui-)?component|what\s+(ui\s+)?component|what\s+element|what\s+ui\s+pattern)/i;
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(https?:\/\/[^\s)]+\)/i;
const QUALITY_REGENERATION_DIRECTIVE = `Quality gate for this regeneration:
- Ensure at least 2 image-based cards that are component-focused (or as many as available images when fewer than 2)
- Component-focused means the stem asks to identify a UI component/pattern or its purpose
- Avoid stems that only ask for design-system/vendor names`;

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
  const requiredComponentImageCards = Math.min(
    MIN_COMPONENT_IMAGE_QUESTIONS,
    input.images.length
  );

  try {
    const primary = await generateUrlCardsWithRetry(input, language);
    const primaryCards = flashcardListSchema.parse(primary.cards);
    const primaryQualityCount = countComponentImageQuestions(primaryCards);

    if (requiredComponentImageCards > 0 && primaryQualityCount < requiredComponentImageCards) {
      try {
        const regenerated = await generateUrlCardsWithRetry(
          input,
          language,
          QUALITY_REGENERATION_DIRECTIVE
        );
        const regeneratedCards = flashcardListSchema.parse(regenerated.cards);
        const regeneratedQualityCount = countComponentImageQuestions(regeneratedCards);
        if (regeneratedQualityCount < requiredComponentImageCards) {
          console.warn(
            `[llm] URL import quality gate unmet after regeneration (${regeneratedQualityCount}/${requiredComponentImageCards})`
          );
        }
        return {
          title: regenerated.title,
          cards: regeneratedCards,
          model,
          fallbackUsed: false,
        };
      } catch (regenerationError) {
        if (regenerationError instanceof Error) {
          console.warn(
            `[llm] URL import regeneration failed, using primary result: ${regenerationError.message}`
          );
        } else {
          console.warn("[llm] URL import regeneration failed, using primary result");
        }
      }
    }

    return {
      title: primary.title,
      cards: primaryCards,
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
  language: string,
  qualityDirective?: string
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
        qualityDirective,
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

function countComponentImageQuestions(cards: Flashcard[]): number {
  return cards.filter((card) => {
    const front = card.front ?? "";
    const back = card.back ?? "";
    const fullText = `${front} ${back}`;
    return MARKDOWN_IMAGE_REGEX.test(fullText) && COMPONENT_IMAGE_QUESTION_REGEX.test(fullText);
  }).length;
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
