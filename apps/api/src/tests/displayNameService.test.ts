import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX,
  validateDisplayName,
  normalizeForFilter,
} from "../services/displayNameService";

function expectOk(input: string, cleaned?: string) {
  const result = validateDisplayName(input);
  expect(result.ok, `"${input}" sollte erlaubt sein`).toBe(true);
  if (result.ok && cleaned !== undefined) expect(result.value).toBe(cleaned);
}

function expectBlocked(input: string, code?: string) {
  const result = validateDisplayName(input);
  expect(result.ok, `"${input}" sollte abgelehnt werden`).toBe(false);
  if (!result.ok && code) expect(result.code).toBe(code);
}

describe("validateDisplayName — Grundregeln", () => {
  it("erlaubt normale Namen und trimmt Leerraum", () => {
    expectOk("Lara", "Lara");
    expectOk("  Lara  ", "Lara");
    expectOk("Lara   M", "Lara M");
    expectOk("Jürgen-Ötzi", "Jürgen-Ötzi");
    expectOk("Mia_2010", "Mia_2010");
    expectOk("O'Brien", "O'Brien");
  });

  it("lehnt zu kurze, zu lange und typfremde Werte ab", () => {
    expectBlocked("L", "DISPLAY_NAME_TOO_SHORT");
    expectBlocked("   ", "DISPLAY_NAME_TOO_SHORT");
    expectBlocked("x".repeat(DISPLAY_NAME_MAX + 1), "DISPLAY_NAME_TOO_LONG");
    expect(validateDisplayName(null).ok).toBe(false);
    expect(validateDisplayName(42).ok).toBe(false);
    expect(validateDisplayName(undefined).ok).toBe(false);
  });

  it("lehnt Sonderzeichen und Namen ohne Buchstaben ab", () => {
    expectBlocked("Lara<script>", "DISPLAY_NAME_INVALID_CHARS");
    expectBlocked("Lara😀", "DISPLAY_NAME_INVALID_CHARS");
    expectBlocked("12345", "DISPLAY_NAME_INVALID_CHARS");
    expectBlocked("Лара", "DISPLAY_NAME_INVALID_CHARS");
  });
});

describe("validateDisplayName — Sperrliste", () => {
  it("blockt grobe Beleidigungen, auch eingebettet", () => {
    expectBlocked("Arschloch", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("XxArschlochxX", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("Hurensohn3000", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("Der Hitler", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("fuckboy", "DISPLAY_NAME_NOT_ALLOWED");
  });

  it("blockt Leetspeak- und Trenn-Schreibweisen", () => {
    expectBlocked("Ar5chl0ch", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("F1ckdich", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("H1tl3r", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("A r s c h l o c h", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("I d i o t", "DISPLAY_NAME_NOT_ALLOWED");
  });

  it("blockt Wort-Begriffe nur als ganzes Wort", () => {
    expectBlocked("Idiot", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("Du Opfer", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("Sex", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("dummkopf lara", "DISPLAY_NAME_NOT_ALLOWED");
  });

  it("lässt harmlose Wörter durch, die verbotene Teile enthalten (Scunthorpe)", () => {
    expectOk("Klasse 8b"); // enthält "ass"
    expectOk("Kanalratte"); // enthält "anal" — als Teilwort erlaubt
    expectOk("Cocktail-Fan"); // enthält "cock"
    expectOk("Saubermann"); // enthält "sau"
    expectOk("Wildschwein"); // enthält "schwein"
    expectOk("Analyse"); // enthält "anal"
  });

  it("blockt Links im Namen", () => {
    // Punkte sind als Zeichen erlaubt — geblockt wird über "www"/"http".
    expectBlocked("www.spam.de", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("wwwspam", "DISPLAY_NAME_NOT_ALLOWED");
    expectBlocked("http lara", "DISPLAY_NAME_NOT_ALLOWED");
  });
});

describe("normalizeForFilter", () => {
  it("löst Leetspeak, Umlaute und ß auf", () => {
    expect(normalizeForFilter("H1tl3r")).toBe("hitler");
    expect(normalizeForFilter("Größe")).toBe("grosse");
    expect(normalizeForFilter("Ärger")).toBe("arger");
    expect(normalizeForFilter("F!ck")).toBe("fick");
  });
});
