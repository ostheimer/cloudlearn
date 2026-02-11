import type { Flashcard } from "./contracts";
import { getEnv } from "./env";

// Prompt template for generating flashcards
const SYSTEM_PROMPT = `You are an expert flashcard creator for students. Given study material (text or an image of study material), create high-quality flashcards.

Rules:
- Create 3-10 flashcards depending on content density
- Each flashcard has: front (question), back (answer), type (basic/cloze), difficulty (easy/medium/hard), tags
- Front: Clear, specific question. Max 500 chars.
- Back: Concise, accurate answer. Max 1000 chars.
- For cloze type: front contains {{c1::hidden text}} format
- Tags: relevant topic keywords, max 3 per card
- Match the language of the input material
- Focus on key concepts, definitions, relationships, and processes
- Vary difficulty levels

Return ONLY valid JSON array, no markdown, no explanation:
[{"front":"...","back":"...","type":"basic","difficulty":"medium","tags":["topic1"]}]`;

interface GeminiContent {
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string };
}

/**
 * Call Gemini API with text input
 */
export async function generateFlashcardsFromText(
  text: string,
  language: string
): Promise<Flashcard[]> {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback to heuristic if no API key
    return heuristicFlashcards(text, language);
  }

  const userContent: GeminiContent = {
    parts: [{ text: `Language: ${language}\n\nStudy material:\n${text}` }],
  };

  return callGemini(apiKey, userContent);
}

/**
 * Call Gemini API with image input (Vision)
 */
export async function generateFlashcardsFromImage(
  imageBase64: string,
  mimeType: string,
  language: string
): Promise<Flashcard[]> {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for image processing");
  }

  const userContent: GeminiContent = {
    parts: [
      { text: `Language: ${language}\n\nGenerate flashcards from the study material in this image:` },
      {
        inline_data: {
          mime_type: mimeType,
          data: imageBase64,
        },
      },
    ],
  };

  return callGemini(apiKey, userContent);
}

/**
 * Core Gemini API call
 */
async function callGemini(
  apiKey: string,
  userContent: GeminiContent
): Promise<Flashcard[]> {
  const model = "gemini-2.5-flash-preview-05-20";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          ...userContent.parts,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data: GeminiResponse = await res.json();

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini returned empty response");
  }

  // Parse the JSON array from the response
  const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Gemini returned invalid flashcard format");
  }

  return parsed;
}

/**
 * Heuristic fallback when no API key is available
 */
function heuristicFlashcards(text: string, language: string): Flashcard[] {
  const lines = text
    .split(/[.\n]/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 10);

  const safeLines = lines.length > 0 ? lines : [text.slice(0, 120)];

  return safeLines.map((line, index) => {
    const prefix = language.startsWith("de")
      ? "Worum geht es in Aussage"
      : "What is the key point in statement";
    return {
      front: `${prefix} ${index + 1}?`,
      back: line,
      type: index % 3 === 0 ? "cloze" : "basic",
      difficulty: "medium",
      tags: ["auto-generated", language],
    };
  });
}
