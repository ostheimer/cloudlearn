import type { Flashcard } from "./contracts";
import { getEnv } from "./env";
import { normalizeTranslationDirection } from "./translationDirection";

// Result type including AI-generated deck title
export interface FlashcardGenerationResult {
  title: string;
  cards: Flashcard[];
}

export interface UrlImageInput {
  sourceUrl: string;
  altText: string;
  contextText: string;
  componentHint: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

// Prompt template for generating flashcards with a descriptive deck title
const SYSTEM_PROMPT = `You are an expert flashcard creator for students. Given study material (text or an image of study material), create high-quality flashcards AND a short, descriptive deck title.

Rules:
- Create 5-25 flashcards depending on content density (more content = more cards)
- Generate a concise deck title (2-5 words) that describes the topic of the material (e.g. "Zellbiologie Grundlagen", "Französische Revolution", "Lineare Algebra")
- Each flashcard has: front (question), back (answer), type (basic/cloze), difficulty (easy/medium/hard), tags, frontLang, backLang
- For "basic" type: front is a clear question, back is the answer
- For "cloze" type: front is a sentence with a blank (use "______" for the gap), back is ONLY the missing word/phrase
  Example cloze: front="Die Hauptstadt von Frankreich ist ______.", back="Paris"
  NEVER put the answer in the front text for cloze cards!
- frontLang/backLang: ISO 639-1 two-letter code of the language on each side ("de", "fr", "en"). For non-translation cards both are the same code.
- Vocabulary/translation material has no natural question side. Pick ONE direction for the WHOLE deck and keep it on EVERY card: if one card asks French → German, all of them must. Never mirror the layout of the source: a source row written "aus dem Diagramm geht hervor, dass — du diagramme il résulte que" still becomes front="du diagramme il résulte que", back="aus dem Diagramm geht hervor, dass" when the deck's direction is French → German.
- Front: Max 500 chars. Back: Max 1000 chars.
- Tags: relevant topic keywords, max 3 per card
- Match the language of the input material (title too!)
- Focus on key concepts, definitions, relationships, and processes
- Vary difficulty levels, mix basic and cloze types

Return ONLY valid JSON object (not array!), no markdown, no explanation:
{"title":"Short Topic Title","cards":[{"front":"...","back":"...","type":"basic","difficulty":"medium","tags":["topic1"],"frontLang":"fr","backLang":"de"}]}`;

const URL_IMPORT_PROMPT = `You are an expert flashcard creator. You will receive webpage text plus optional inline images with metadata.

Rules:
- Create 5-25 flashcards depending on content density
- Generate a concise deck title (2-5 words) in the same language as the source
- Each card has: front, back, type (basic/cloze), difficulty, tags
- Use high-value concepts, definitions, and relationships
- If images are provided, prioritize component-identification questions over branding questions
- Create at least 2 image-based cards when possible
- At least 2 image-based cards should ask what UI component/pattern is shown and what it does
- Avoid "Which design system is this?" questions unless component details are truly unavailable
- Do not put vendor or design-system names in the question stem of image cards when a component question is possible
- Prefer stems like: "Welche UI-Komponente ist im Bild dargestellt?" or "Wofür wird dieses Element verwendet?"
- Use component_hint and nearby_text as primary clues for image-based cards
- For image-based cards, include exactly one markdown image reference in the front or back:
  ![short alt text](https://absolute-image-url)
- Keep markdown image URL exactly as provided in metadata; do not invent URLs
- Keep front <= 500 chars and back <= 1000 chars
- Keep answers concise and factual
- frontLang/backLang: ISO 639-1 two-letter code of the language on each side ("de", "fr", "en"). For non-translation cards both are the same code.
- Vocabulary/translation material has no natural question side. Pick ONE direction for the WHOLE deck and keep it on EVERY card, regardless of how the source lists the pairs.

Return ONLY valid JSON object (not array!), no markdown wrapper:
{"title":"Short Topic Title","cards":[{"front":"...","back":"...","type":"basic","difficulty":"medium","tags":["topic1"],"frontLang":"de","backLang":"de"}]}`;

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
 * Call Gemini API with webpage text and multiple images
 */
export async function generateFlashcardsFromWebContent(input: {
  sourceUrl: string;
  pageTitle: string;
  textContent: string;
  language: string;
  images: UrlImageInput[];
  qualityDirective?: string;
}): Promise<FlashcardGenerationResult> {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return heuristicFlashcards(input.textContent, input.language);
  }

  const pageText = input.textContent.slice(0, 18_000);
  const imageParts = input.images.flatMap((image, index) => {
    const metadata = `Image ${index + 1} metadata:
- absolute_url: ${image.sourceUrl}
- alt_text: ${image.altText || "(none)"}
- component_hint: ${image.componentHint || "(none)"}
- nearby_text: ${image.contextText || "(none)"}`;

    return [
      { text: metadata },
      {
        inline_data: {
          mime_type: image.mimeType,
          data: image.dataBase64,
        },
      },
    ] satisfies GeminiContent["parts"];
  });

  const userContent: GeminiContent = {
    parts: [
      {
        text: `Language: ${input.language}
Source URL: ${input.sourceUrl}
Page title: ${input.pageTitle}

Extracted study material:
${pageText}`,
      },
      ...(input.qualityDirective
        ? [{ text: `Quality directive:\n${input.qualityDirective}` } as const]
        : []),
      ...imageParts,
    ],
  };

  return callGemini(apiKey, userContent, URL_IMPORT_PROMPT);
}

/**
 * Core Gemini API call — returns { title, cards }
 */
async function callGemini(
  apiKey: string,
  userContent: GeminiContent,
  systemPrompt = SYSTEM_PROMPT
): Promise<FlashcardGenerationResult> {
  const model = "gemini-3-flash-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
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
    return { title: deriveTitle(parsed), cards: normalizeTranslationDirection(parsed) };
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.cards)) {
    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : deriveTitle(parsed.cards);
    if (parsed.cards.length === 0) throw new Error("Gemini returned empty card list");
    return { title, cards: normalizeTranslationDirection(parsed.cards) };
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
