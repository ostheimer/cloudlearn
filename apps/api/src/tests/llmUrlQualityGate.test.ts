import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateFlashcardsFromUrlContentAsync } from "@/lib/llm";
import { generateFlashcardsFromWebContent } from "@/lib/flashcardGenerator";

vi.mock("@/lib/flashcardGenerator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flashcardGenerator")>();
  return {
    ...actual,
    generateFlashcardsFromWebContent: vi.fn(),
  };
});

const mockedGenerateFromWeb = vi.mocked(generateFlashcardsFromWebContent);

const baseInput = {
  sourceUrl: "https://component.gallery/",
  pageTitle: "The Component Gallery",
  extractedText:
    "The Component Gallery is an up-to-date repository of interface components with design-system examples.",
  images: [
    {
      sourceUrl: "https://img.example.com/1.webp",
      altText: "",
      contextText: "UI preview one",
      componentHint: "Pagination",
      mimeType: "image/webp" as const,
      dataBase64: "AQID",
    },
    {
      sourceUrl: "https://img.example.com/2.webp",
      altText: "",
      contextText: "UI preview two",
      componentHint: "Dialog",
      mimeType: "image/webp" as const,
      dataBase64: "AQID",
    },
    {
      sourceUrl: "https://img.example.com/3.webp",
      altText: "",
      contextText: "UI preview three",
      componentHint: "Tabs",
      mimeType: "image/webp" as const,
      dataBase64: "AQID",
    },
    {
      sourceUrl: "https://img.example.com/4.webp",
      altText: "",
      contextText: "UI preview four",
      componentHint: "Accordion",
      mimeType: "image/webp" as const,
      dataBase64: "AQID",
    },
  ],
};

function makeCard(front: string, back: string) {
  return {
    front,
    back,
    type: "basic" as const,
    difficulty: "medium" as const,
    tags: ["ui"],
  };
}

describe("llm URL quality gate", () => {
  beforeEach(() => {
    mockedGenerateFromWeb.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("regenerates once when component-focused image questions are below threshold", async () => {
    mockedGenerateFromWeb
      .mockResolvedValueOnce({
        title: "Primary Result",
        cards: [
          makeCard(
            "Welches Design-System ist zu sehen? ![Preview](https://img.example.com/1.webp)",
            "Ariakit"
          ),
          makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich."),
        ],
      })
      .mockResolvedValueOnce({
        title: "Regenerated Result",
        cards: [
          makeCard(
            "Welche UI-Komponente ist dargestellt? ![Preview](https://img.example.com/1.webp)",
            "Pagination"
          ),
          makeCard(
            "Wofür wird dieses Element verwendet? ![Preview](https://img.example.com/2.webp)",
            "Dialog zur Bestaetigung."
          ),
          makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich."),
        ],
      });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.title).toBe("Regenerated Result");
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(2);
    expect(mockedGenerateFromWeb.mock.calls[1]?.[0]).toMatchObject({
      qualityDirective: expect.stringContaining("Quality gate"),
    });
  });

  it("keeps primary result when quality gate is already satisfied", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Primary Good Result",
      cards: [
        makeCard(
          "Welche UI-Komponente ist dargestellt? ![Preview](https://img.example.com/1.webp)",
          "Pagination"
        ),
        makeCard(
          "Welches Pattern ist das? ![Preview](https://img.example.com/2.webp)",
          "Ein Dialog."
        ),
        makeCard("Was ist ein Carousel?", "Ein Content-Slider."),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.title).toBe("Primary Good Result");
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(1);
  });

  it("uses heuristic fallback when primary generation fails after retries", async () => {
    mockedGenerateFromWeb.mockRejectedValue(new Error("Gemini unavailable"));

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(true);
    expect(result.model).toBe("heuristic-fallback");
    expect(result.cards.length).toBeGreaterThan(0);
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(2);
  });

  it("keeps primary result when regeneration fails", async () => {
    mockedGenerateFromWeb
      .mockResolvedValueOnce({
        title: "Primary Result",
        cards: [
          makeCard(
            "Welches Design-System ist zu sehen? ![Preview](https://img.example.com/1.webp)",
            "Ariakit"
          ),
          makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich."),
        ],
      })
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"));

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.title).toBe("Primary Result");
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(3);
  });
});
