import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateFlashcardsFromImage,
  generateFlashcardsFromText,
  generateFlashcardsFromWebContent,
} from "@/lib/flashcardGenerator";

function card(front: string, back: string, type: "basic" | "cloze") {
  return { front, back, type, difficulty: "medium", tags: ["Begriffe"], frontLang: "de", backLang: "de" };
}

// The first and last pair reproduce the two variants observed on the iPhone.
// The other six are synthetic fixtures: no private photo or user deck is stored.
const pairs = [
  [
    card("Wie nennt man das Fliegen von Vögeln (z. B. Fasan) auf einen Baum zum Schlafen oder Rasten?", "Aufbaumen", "basic"),
    card("Das Fliegen von Vögeln auf einen Baum zum Schlafen nennt man ______.", "Aufbaumen", "cloze"),
  ],
  ...Array.from({ length: 6 }, (_, i) => [
    card(`Wie nennt man den synthetischen Vorgang Nummer ${i + 1} im Lernstoff?`, `Begriff ${i + 1}`, "basic"),
    card(`Den synthetischen Vorgang Nummer ${i + 1} im Lernstoff nennt man ______.`, `Begriff ${i + 1}`, "cloze"),
  ]),
  [
    card("Wie nennt man das Vergraben von Beuteresten durch den Fuchs?", "Einscharren", "basic"),
    card("Das Vergraben von Beuteresten durch den Fuchs wird als ______ bezeichnet.", "Einscharren", "cloze"),
  ],
];

function stubGemini(cards: ReturnType<typeof card>[], legacy = false) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{
      text: JSON.stringify(legacy ? cards : { title: "Begriffe", cards }),
    }] } }] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "local-test-key"));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("one generated card per fact, without mirrored basic/cloze variants", () => {
  it("returns eight facts when image generation supplies sixteen format variants", async () => {
    const fetchMock = stubGemini(pairs.flat());
    const result = await generateFlashcardsFromImage("test-image", "image/jpeg", "de");
    expect(result.cards).toEqual(pairs.map(([basic]) => basic));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prefers the question card even when the cloze variant arrives first", async () => {
    const [basic, cloze] = pairs[7]!;
    stubGemini([cloze!, basic!], true);
    expect((await generateFlashcardsFromImage("test-image", "image/jpeg", "de")).cards).toEqual([basic]);
  });

  it("keeps different facts with the same answer, standalone cloze, and different languages", async () => {
    const cards = [
      card("Wie nennt man das Vergraben von Beuteresten durch den Fuchs?", "Einscharren", "basic"),
      card("Das Vergraben von Nahrung durch den Dachs wird als ______ bezeichnet.", "Einscharren", "cloze"),
      card("Wenn ein Hase bei Gefahr reglos in seiner Sasse verharrt, nennt man das ______.", "Drücken", "cloze"),
      { ...pairs[7]![1]!, frontLang: "en" },
      card("Wie nennt man das schnelle Fliegen von Vögeln auf einen Baum zum Schlafen?", "Aufbaumen", "basic"),
      pairs[0]![1]!,
    ];
    stubGemini(cards);
    expect((await generateFlashcardsFromImage("test-image", "image/jpeg", "de")).cards).toEqual(cards);
  });

  it("does not merge opposites, word-order differences, or short ambiguous fronts", async () => {
    const cards = [
      card("Wie nennt man das Verhalten wenn ein Hund einen Mann beißt?", "Angriff", "basic"),
      card("Das Verhalten wenn ein Mann einen Hund beißt nennt man ______.", "Angriff", "cloze"),
      card("Wie nennt man das Verhalten wenn der Hund nicht bellt?", "Stillsein", "basic"),
      card("Das Verhalten wenn der Hund bellt nennt man ______.", "Stillsein", "cloze"),
      card("Wie nennt man X?", "Test", "basic"),
      card("X nennt man ______.", "Test", "cloze"),
    ];
    stubGemini(cards);
    expect((await generateFlashcardsFromImage("test-image", "image/jpeg", "de")).cards).toEqual(cards);
  });

  it.each(["text", "url"])("also removes mirrored variants from the shared %s generator", async (source) => {
    const [basic, cloze] = pairs[7]!;
    stubGemini([basic!, cloze!]);
    const result = source === "text"
      ? await generateFlashcardsFromText("Ein ausreichend langer synthetischer Lerntext.", "de")
      : await generateFlashcardsFromWebContent({ sourceUrl: "https://example.test", pageTitle: "Begriffe", textContent: "Lernstoff", language: "de", images: [] });
    expect(result.cards).toEqual([basic]);
  });
});
