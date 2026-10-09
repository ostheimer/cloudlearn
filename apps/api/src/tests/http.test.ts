import { describe, expect, it } from "vitest";
import { HttpError, normalizeError } from "@/lib/http";

describe("normalizeError", () => {
  it("gibt interne Datenbankmeldungen nicht an den Client weiter (#702)", () => {
    expect(
      normalizeError(new Error("listCards: password authentication failed for user postgres"))
    ).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      status: 500,
    });
  });

  it("behält bewusst gesetzte HttpError-Antworten bei", () => {
    expect(normalizeError(new HttpError("Deck voll", 409, "DECK_LIMIT_REACHED"))).toEqual({
      code: "DECK_LIMIT_REACHED",
      message: "Deck voll",
      status: 409,
    });
  });
});
