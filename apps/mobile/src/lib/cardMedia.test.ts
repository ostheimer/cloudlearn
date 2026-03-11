import { describe, expect, it } from "vitest";
import {
  parseMarkdownImages,
  stripMarkdownImages,
  summarizeCardMedia,
} from "./cardMedia";

describe("cardMedia helpers", () => {
  it("extracts markdown image references with alt and url", () => {
    const text =
      "Beschrifte das Element ![Gallery Item](https://example.com/gallery.png) korrekt.";
    const images = parseMarkdownImages(text);

    expect(images).toHaveLength(1);
    expect(images[0]?.alt).toBe("Gallery Item");
    expect(images[0]?.url).toBe("https://example.com/gallery.png");
  });

  it("removes markdown images from text while keeping readable content", () => {
    const cleaned = stripMarkdownImages(
      "![Komponente](https://example.com/a.png) Das ist ein Button."
    );
    expect(cleaned).toBe("Das ist ein Button.");
  });

  it("builds a media summary with primary image and preferred label", () => {
    const summary = summarizeCardMedia({
      front: "Was ist dargestellt? ![Card](https://example.com/card.png)",
      back: "Info Card",
    });

    expect(summary.primaryImage?.url).toBe("https://example.com/card.png");
    expect(summary.plainFront).toBe("Was ist dargestellt?");
    expect(summary.preferredLabel).toBe("Info Card");
  });
});
