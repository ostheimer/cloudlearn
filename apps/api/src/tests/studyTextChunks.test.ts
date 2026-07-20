import { describe, expect, it } from "vitest";
import { mergeChunkCards, splitStudyText } from "@/lib/studyTextChunks";

const sentences = (count: number, word = "Wort") =>
  Array.from({ length: count }, (_, i) => `${word} ${i} steht in diesem Satz mit genug Länge.`).join(" ");

describe("splitStudyText", () => {
  it("leaves short material as a single call", () => {
    expect(splitStudyText("Kurzer Lerntext.")).toEqual(["Kurzer Lerntext."]);
  });

  it("returns nothing for empty input", () => {
    expect(splitStudyText("   ")).toEqual([]);
  });

  it("splits long material and loses no content", () => {
    const text = sentences(900);
    const chunks = splitStudyText(text);

    expect(chunks.length).toBeGreaterThan(1);
    // Rejoining must reproduce the source, ignoring the whitespace at the seams.
    const rejoined = chunks.join(" ").replace(/\s+/g, " ").trim();
    expect(rejoined).toBe(text.replace(/\s+/g, " ").trim());
  });

  it("breaks on sentence ends so no definition is cut in half", () => {
    const chunks = splitStudyText(sentences(900));
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.endsWith(".")).toBe(true);
    }
  });

  it("never emits a scrap chunk from a short tail", () => {
    // 8200 chars would otherwise leave a ~200-char remainder.
    const chunks = splitStudyText("a".repeat(8_200));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(8_200);
  });

  it("keeps chunks near the requested size", () => {
    for (const chunk of splitStudyText(sentences(2_000))) {
      expect(chunk.length).toBeLessThanOrEqual(10_000);
    }
  });
});

describe("mergeChunkCards", () => {
  const card = (front: string) => ({ front, back: "x" });

  it("merges groups in order", () => {
    const merged = mergeChunkCards([[card("Frage A"), card("Frage B")], [card("Frage C")]], 100);
    expect(merged.map((c) => c.front)).toEqual(["Frage A", "Frage B", "Frage C"]);
  });

  // A concept spanning a chunk boundary can be asked twice.
  it("drops a repeat across chunks despite punctuation and casing", () => {
    const merged = mergeChunkCards([[card("Was ist Clusterung?")], [card("was ist clusterung")]], 100);
    expect(merged).toHaveLength(1);
  });

  it("stops at the limit", () => {
    const groups = [[card("a"), card("b"), card("c")], [card("d")]];
    expect(mergeChunkCards(groups, 2).map((c) => c.front)).toEqual(["a", "b"]);
  });

  it("ignores cards with an unusable question", () => {
    expect(mergeChunkCards([[card(""), card("   "), card("Echte Frage?")]], 100)).toHaveLength(1);
  });

  // Questions sharing a long opening are still distinct cards.
  it("keeps questions that differ beyond the compared prefix", () => {
    const a = card("Nenne die wichtigsten Anwendungen des unüberwachten Lernens im Bereich Medizin");
    const b = card("Nenne die wichtigsten Anwendungen des unüberwachten Lernens im Bereich Handel");
    expect(mergeChunkCards([[a, b]], 100)).toHaveLength(2);
  });
});
