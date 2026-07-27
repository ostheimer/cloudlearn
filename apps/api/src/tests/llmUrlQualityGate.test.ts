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

  it("drops image-dependent markdown cards instead of returning raw image code (#534)", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Mitochondrium",
      cards: [
        makeCard(
          "Welche UI-Komponente ist im Bild dargestellt? ![Mitochondrium Diagramm](https://img.example.com/1.webp)",
          "Ein schematisches Diagramm eines tierischen Mitochondriums."
        ),
        makeCard(
          "Wofür wird das in der Abbildung gezeigte ringförmige Element verwendet? ![Mitochondriale DNA](https://img.example.com/2.webp)",
          "Es trägt einen Teil der Erbinformation."
        ),
        makeCard("Welche Aufgabe haben Mitochondrien?", "Sie stellen Energie für die Zelle bereit."),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.cards.map((card) => card.front)).toEqual([
      "Welche Aufgabe haben Mitochondrien?",
    ]);
    expect(result.cards.every((card) => !`${card.front} ${card.back}`.includes("!["))).toBe(true);
  });

  it("drops visual-reference cards even when image markup is missing (#534)", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Mitochondrium",
      cards: [
        makeCard(
          "Welche Struktur ist in der Abbildung zu sehen?",
          "Ein schematisches Diagramm eines Mitochondriums."
        ),
        makeCard("Was zeigt die Abbildung?", "Eine mitochondriale Membran."),
        makeCard("Welche Struktur ist dargestellt?", "Eine ATP-Synthase."),
        makeCard("What is shown in the image?", "A mitochondrial membrane."),
        makeCard("What does the figure show?", "A mitochondrion."),
        makeCard("Welche Struktur ist das? <img src=\"https://img.example.com/1.webp\">", "ATP-Synthase."),
        makeCard("Welche Struktur ist das? https://img.example.com/2.png", "Mitochondriale DNA."),
        makeCard("Was ist ein UML-Diagramm?", "Das Diagramm zeigt Strukturen und Beziehungen."),
        makeCard("Was ist dargestellt durch x + y?", "Eine Summe."),
        makeCard("Welche Aufgabe haben Mitochondrien?", "Sie stellen Energie bereit."),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.cards.map((card) => card.front)).toEqual([
      "Was ist ein UML-Diagramm?",
      "Was ist dargestellt durch x + y?",
      "Welche Aufgabe haben Mitochondrien?",
    ]);
  });

  it("keeps text-grounded questions about who displays an image", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Sternennacht",
      cards: [
        makeCard(
          "Welches Museum zeigt das Bild „Sternennacht“?",
          "Das Museum of Modern Art in New York."
        ),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.cards.map((card) => card.front)).toEqual([
      "Welches Museum zeigt das Bild „Sternennacht“?",
    ]);
  });

  it("drops context-free visual questions regardless of their noun", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Bildfragen",
      cards: [
        makeCard("Welches Organ ist dargestellt?", "Das Herz."),
        makeCard("Welches Tier ist abgebildet?", "Ein Rotfuchs."),
        makeCard("Welche Person wird hier gezeigt?", "Marie Curie."),
        makeCard("Welche Aufgabe hat das Herz?", "Es pumpt Blut durch den Körper."),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.cards.map((card) => card.front)).toEqual([
      "Welche Aufgabe hat das Herz?",
    ]);
  });

  it("does not force image questions when normal text cards are returned", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Primary Result",
      cards: [makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich.")],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.title).toBe("Primary Result");
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(1);
  });

  it("clamps a successful URL-generation title to the API contract", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "A".repeat(120),
      cards: [makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich.")],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.title).toHaveLength(100);
  });

  it("clamps a title without splitting a non-BMP Unicode character", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: `${"A".repeat(99)}😀`,
      cards: [makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich.")],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.title).toBe("A".repeat(99));
  });

  it("uses the text fallback when every generated card depends on an image", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Image-only Result",
      cards: [
        makeCard(
          "Welche UI-Komponente ist dargestellt? ![Preview](https://img.example.com/1.webp)",
          "Pagination"
        ),
        makeCard(
          "Welches Pattern ist das? ![Preview](https://img.example.com/2.webp)",
          "Ein Dialog."
        ),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(true);
    expect(result.model).toBe("heuristic-fallback");
    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards.every((card) => !`${card.front} ${card.back}`.includes("!["))).toBe(true);
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(1);
  });

  it("clamps long text fallback cards to the schema limit (#534)", async () => {
    mockedGenerateFromWeb.mockResolvedValueOnce({
      title: "Image-only Result",
      cards: [
        makeCard(
          "Welche Struktur ist dargestellt? ![Preview](https://img.example.com/1.webp)",
          "Ein Diagramm."
        ),
      ],
    });

    const result = await generateFlashcardsFromUrlContentAsync(
      { ...baseInput, extractedText: "A".repeat(1_200) },
      "de"
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.title.length).toBeLessThanOrEqual(100);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.back).toHaveLength(1_000);
  });

  it("uses heuristic fallback when primary generation fails after retries", async () => {
    mockedGenerateFromWeb.mockRejectedValue(new Error("Gemini unavailable"));

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(true);
    expect(result.model).toBe("heuristic-fallback");
    expect(result.cards.length).toBeGreaterThan(0);
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(2);
  });

  it("retries once when initial generation fails and keeps the successful result", async () => {
    mockedGenerateFromWeb
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce({
        title: "Primary Result",
        cards: [makeCard("Was ist ein Accordion?", "Ein aufklappbarer Bereich.")],
      });

    const result = await generateFlashcardsFromUrlContentAsync(baseInput, "de");

    expect(result.fallbackUsed).toBe(false);
    expect(result.title).toBe("Primary Result");
    expect(mockedGenerateFromWeb).toHaveBeenCalledTimes(2);
  });
});
