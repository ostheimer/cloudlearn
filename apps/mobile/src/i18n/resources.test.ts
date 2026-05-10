import { describe, expect, it } from "vitest";
import { resources } from "./resources";

function flattenValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenValues);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flattenValues);
  }

  return [];
}

describe("i18n resources", () => {
  it("contains German default and English translation keys", () => {
    expect(resources.de.translation.loginTitle).toBeTypeOf("string");
    expect(resources.en.translation.loginTitle).toBeTypeOf("string");
    expect(resources.de.translation.scanTab).toBeTypeOf("string");
    expect(resources.en.translation.scanTab).toBeTypeOf("string");
  });

  it("keeps release copy free from placeholder launch language", () => {
    const allCopy = flattenValues(resources).join("\n");

    expect(allCopy).not.toMatch(
      /\b(coming soon|scaffold|placeholder|lorem ipsum)\b/i
    );
    expect(allCopy).not.toMatch(/\b(folgt bald|folgt in kürze|platzhalter)\b/i);
  });

  it("uses real umlauts in visible German copy", () => {
    const germanCopy = flattenValues(resources.de.translation).join("\n");

    expect(germanCopy).not.toMatch(
      /\b(Geraet|geraet|oeffnen|Oeffnen|koennen|Koennen|muessen|Muessen|fuer|Fuer|ueber|Ueber|zurueck|Zurueck)\b/
    );
  });

  it("does not promise unlimited Pro usage in paywall copy", () => {
    const paywallCopy = [
      resources.de.translation["paywall.unlimited"],
      resources.de.translation["paywall.feature.scans"],
      resources.de.translation["paywall.feature.url"],
      resources.de.translation["paywall.feature.decks"],
      resources.en.translation["paywall.unlimited"],
      resources.en.translation["paywall.feature.scans"],
      resources.en.translation["paywall.feature.url"],
      resources.en.translation["paywall.feature.decks"],
    ].join("\n");

    expect(paywallCopy).not.toMatch(/\b(unlimited|unbegrenzt|unbegrenzte)\b/i);
  });
});
