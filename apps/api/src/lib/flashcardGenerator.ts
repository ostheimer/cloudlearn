import type { Flashcard } from "./contracts";
import { MAX_GENERATED_CARDS } from "./contracts";
import { dropSelfRevealingCards } from "./cardQuality";
import { getEnv } from "./env";
import { splitStudyText, mergeChunkCards } from "./studyTextChunks";
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
- Cover the material COMPLETELY: create one flashcard for every distinct fact, definition, term, process, example or relationship a student could be examined on. Do not stop early, do not summarise, do not pick highlights — a dense page is worth many cards. Hard cap: 50 cards.
- ENUMERATIONS ARE THE MOST EXAM-RELEVANT PART and the easiest to miss. Whenever the material lists several items together — advantages, disadvantages, steps, phases, components, tasks, roles, causes, risks, examples, types, key facts — make a card that asks for the LIST ITSELF ("Nenne die vier Nachteile von X", "Welche Phasen hat Y?"), with all items in the answer. Individual cards about single items do NOT replace the list card; write both. This applies to bullet lists, tables, and summary/"Merksätze" blocks alike.
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
- Cover the material completely: one flashcard per distinct fact, definition, term or relationship worth examining. Do not summarise or pick highlights. Hard cap: 50 cards.
- Whenever the source lists several items together (advantages, disadvantages, steps, components, types, examples), also make a card that asks for the LIST itself, with all items in the answer. Cards about single items do not replace the list card.
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

  const chunks = splitStudyText(text);
  const ask = (part: string) =>
    callGemini(apiKey, { parts: [{ text: `Language: ${language}\n\nStudy material:\n${part}` }] });

  if (chunks.length <= 1) return ask(chunks[0] ?? text);

  // One call per chunk, in parallel — see studyTextChunks.ts for why splitting
  // beats one large call.
  //
  // A chunk that fails must never be skipped. This code first collected whatever
  // chunks happened to succeed, on the reasoning that one bad chunk should not
  // sink the whole import. It cost a real deck: a transient failure on chunk 1
  // of 3 produced a deck missing the entire first third of the chapter — the
  // definition of the topic, the worked examples — while looking complete.
  // Nobody can spot material that was never offered, which is the same silent
  // loss the 20_000-character extraction cap used to cause.
  //
  // So every chunk is retried, and if one is still unanswered afterwards the
  // whole generation fails. A visibly failed import can be repeated; a deck
  // quietly missing a third of its subject cannot even be noticed.
  const results = await Promise.all(chunks.map((chunk) => askWithRetry(() => ask(chunk))));

  return {
    // Every chunk titles its own slice; the first chunk saw the document's
    // opening and so names the topic best.
    title: results[0]!.title,
    cards: mergeChunkCards(
      results.map((r) => r.cards),
      MAX_GENERATED_CARDS
    ),
  };
}

const CHUNK_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Run one chunk's generation, retrying transient failures.
 *
 * The observed failure was a one-off: the same chunk succeeded on every later
 * attempt. Retrying with a growing pause absorbs exactly that case, and also
 * the rate limiting that becomes likelier as a long document produces more
 * parallel calls. After the last attempt the error propagates — see the caller
 * for why partial output is not an acceptable outcome.
 */
async function askWithRetry(
  attempt: () => Promise<FlashcardGenerationResult>
): Promise<FlashcardGenerationResult> {
  let lastError: unknown;
  for (let tries = 1; tries <= CHUNK_ATTEMPTS; tries++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (tries < CHUNK_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** (tries - 1)));
      }
    }
  }
  throw lastError instanceof Error
    ? new Error(`Flashcard generation failed after ${CHUNK_ATTEMPTS} attempts: ${lastError.message}`)
    : new Error(`Flashcard generation failed after ${CHUNK_ATTEMPTS} attempts`);
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
      // gemini-3-flash is a thinking model and its thinking tokens are billed
      // against maxOutputTokens, before a single card is written. Measured
      // thinking on one vocab sheet swung between 1357 and 7005 tokens run to
      // run, so a 4096 ceiling truncated the JSON mid-string at random — the
      // scan then died in JSON.parse. This is a ceiling, not a reservation:
      // unused tokens cost nothing, so keep ample room for the worst-case
      // thinking plus ~2000 tokens of cards.
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      // Card generation is extraction, not reasoning, so the thinking budget
      // buys nothing here. Measured across 3 PIT PDFs (Programmieren,
      // Datenbanken, KI), 4 runs each: unrestricted thinking averaged 1250
      // tokens of thought and produced 15.0 / 16.25 / 14.0 cards per run;
      // "low" produced 15.0 / 15.0 / 14.5 from the same material for ~45% fewer
      // billed tokens. It also removes the 1357-7005 token swing that used to
      // truncate responses at random.
      thinkingConfig: { thinkingLevel: "low" },
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
    return { title: deriveTitle(parsed), cards: refineCards(parsed) };
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.cards)) {
    const title = typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim()
      : deriveTitle(parsed.cards);
    if (parsed.cards.length === 0) throw new Error("Gemini returned empty card list");
    return { title, cards: refineCards(parsed.cards) };
  }

  throw new Error("Gemini returned invalid flashcard format");
}

/**
 * Post-process every generated batch: enforce the deck-wide translation
 * direction, then drop cards that give away their own answer. Both rules are
 * stated in the prompt; both are enforced here because the prompt is a request.
 */
function refineCards(cards: Flashcard[]): Flashcard[] {
  return dropSelfRevealingCards(normalizeTranslationDirection(cards));
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
