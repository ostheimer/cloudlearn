import type { Flashcard } from "./contracts";
import { getEnv } from "./env";

// Result type including AI-generated deck title
export interface FlashcardGenerationResult {
  title: string;
  cards: Flashcard[];
}

// Prompt template for generating flashcards with a descriptive deck title
const SYSTEM_PROMPT = `You are an expert flashcard creator for students. Given study material (text or an image of study material), create high-quality flashcards AND a short, descriptive deck title.

Rules:
- Create 5-25 flashcards depending on content density (more content = more cards)
- Generate a concise deck title (2-5 words) that describes the topic of the material (e.g. "Zellbiologie Grundlagen", "Französische Revolution", "Lineare Algebra")
- Each flashcard has: front (question), back (answer), type (basic/cloze), difficulty (easy/medium/hard), tags
- For "basic" type: front is a clear question, back is the answer
- For "cloze" type: front is a sentence with a blank (use "______" for the gap), back is ONLY the missing word/phrase
  Example cloze: front="Die Hauptstadt von Frankreich ist ______.", back="Paris"
  NEVER put the answer in the front text for cloze cards!
- Front: Max 500 chars. Back: Max 1000 chars.
- Tags: relevant topic keywords, max 3 per card
- Match the language of the input material (title too!)
- Focus on key concepts, definitions, relationships, and processes
- Vary difficulty levels, mix basic and cloze types

Return ONLY valid JSON object (not array!), no markdown, no explanation:
{"title":"Short Topic Title","cards":[{"front":"...","back":"...","type":"basic","difficulty":"medium","tags":["topic1"]}]}`;

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
): Promise<FlashcardGenerationResult> {
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
): Promise<FlashcardGenerationResult> {
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
 * Core Gemini API call — returns { title, cards }
 */
async function callGemini(
  apiKey: string,
  userContent: GeminiContent
): Promise<FlashcardGenerationResult> {
  const model = "gemini-3-flash-preview";
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

  // Parse the JSON from the response
  const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Support both formats: { title, cards: [...] } or legacy [...] array
  if (Array.isArray(parsed)) {
    // Legacy array format — generate a fallback title
    if (parsed.length === 0) throw new Error("Gemini returned empty card list");
    return { title: deriveTitle(parsed), cards: parsed };
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.cards)) {
    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : deriveTitle(parsed.cards);
    if (parsed.cards.length === 0) throw new Error("Gemini returned empty card list");
    return { title, cards: parsed.cards };
  }

  throw new Error("Gemini returned invalid flashcard format");
}

/**
 * Derive a short title from the first card's tags or content
 */
function deriveTitle(cards: Array<{ tags?: string[]; front?: string }>): string {
  // Try to build title from the most common tags
  const allTags = cards.flatMap((c) => c.tags ?? []).filter((t) => t.length > 1);
  if (allTags.length > 0) {
    const freq = new Map<string, number>();
    for (const t of allTags) freq.set(t, (freq.get(t) ?? 0) + 1);
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 2).map(([tag]) => tag.charAt(0).toUpperCase() + tag.slice(1)).join(" – ");
  }
  // Fallback: first few words of the first card
  const firstFront = cards[0]?.front ?? "";
  return firstFront.split(/\s+/).slice(0, 4).join(" ") || "Lernkarten";
}

/**
 * Heuristic fallback when no API key is available
 */
function heuristicFlashcards(text: string, language: string): FlashcardGenerationResult {
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

  // Derive a title from the first meaningful words
  const titleWords = text.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
  const title = titleWords.length > 0 ? titleWords.join(" ") : "Lernkarten";

  return { title, cards };
}
