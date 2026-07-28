import { describe, expect, it } from "vitest";
import { flashcardSchema, scanProcessRequestSchema } from "@/lib/contracts";

// #440: `sourceImageUrl` heißt „URL", trägt aber einen relativen Storage-Pfad.
// Diese Tests zurren beide Hälften des Aufräumens fest:
//  - flashcardSchema erzwingt jetzt „Pfad, keine URL" (fremde http-Adresse
//    würde beim Öffnen des Decks einen fremden Server anpingen).
//  - scanProcessRequestSchema kennt das Feld gar nicht mehr (war tot: kein
//    Client sendet es, kein Handler liest es) — statt es als echte URL zu
//    erzwingen, wird ein mitgeschickter Wert einfach verworfen.
const baseCard = { front: "Frage", back: "Antwort" } as const;

describe("#440 sourceImageUrl ist ein Speicher-Pfad, keine URL", () => {
  it("accepts a real storage path on a card", () => {
    const parsed = flashcardSchema.parse({
      ...baseCard,
      sourceImageUrl: "7e8cd2f6-0a3d-45fa-a0f8-d71d8fcd3e38/deck/bild.png",
    });
    expect(parsed.sourceImageUrl).toBe(
      "7e8cd2f6-0a3d-45fa-a0f8-d71d8fcd3e38/deck/bild.png",
    );
  });

  it("keeps the field optional (undefined stays valid)", () => {
    const parsed = flashcardSchema.parse({ ...baseCard });
    expect(parsed.sourceImageUrl).toBeUndefined();
  });

  it("rejects a foreign http(s) URL", () => {
    const result = flashcardSchema.safeParse({
      ...baseCard,
      sourceImageUrl: "https://example.com/bild.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a leading slash (not a relative bucket path)", () => {
    const result = flashcardSchema.safeParse({
      ...baseCard,
      sourceImageUrl: "/deck/bild.png",
    });
    expect(result.success).toBe(false);
  });

  it("scan request no longer carries sourceImageUrl (dead field removed)", () => {
    const parsed = scanProcessRequestSchema.parse({
      userId: "7e8cd2f6-0a3d-45fa-a0f8-d71d8fcd3e38",
      extractedText: "Ein kurzer OCR-Text",
      idempotencyKey: "scan-key-1234",
      // Früher als echte URL erzwungen; jetzt unbekannt und daher verworfen.
      sourceImageUrl: "https://example.com/bild.png",
    });
    expect((parsed as Record<string, unknown>).sourceImageUrl).toBeUndefined();
  });
});
