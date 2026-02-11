import type { Flashcard } from "./contracts";
import { flashcardListSchema } from "./contracts";
import { generateFlashcardsFromText } from "./flashcardGenerator";

function callPrimaryModel(text: string, language: string): Flashcard[] {
  if (text.toLowerCase().includes("[force-fallback]")) {
    throw new Error("Primary model unavailable");
  }

  return generateFlashcardsFromText(text, language);
}

function callFallbackModel(text: string, language: string): Flashcard[] {
  const fallbackText = text.replace("[force-fallback]", "").trim();
  return generateFlashcardsFromText(fallbackText || text, language).map((card) => ({
    ...card,
    tags: [...card.tags, "fallback-model"]
  }));
}

export function generateWithModelFallback(text: string, language: string): {
  cards: Flashcard[];
  model: string;
  fallbackUsed: boolean;
} {
  try {
    const cards = flashcardListSchema.parse(callPrimaryModel(text, language));
    return {
      cards,
      model: "gemini-2.5-flash",
      fallbackUsed: false
    };
  } catch {
    const cards = flashcardListSchema.parse(callFallbackModel(text, language));
    return {
      cards,
      model: "gpt-4o-mini-fallback",
      fallbackUsed: true
    };
  }
}
