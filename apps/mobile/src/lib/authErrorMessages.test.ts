import { describe, expect, it } from "vitest";
import { toGermanAuthError } from "./authErrorMessages";

describe("toGermanAuthError", () => {
  it("translates invalid login credentials", () => {
    expect(toGermanAuthError("Invalid login credentials")).toBe(
      "E-Mail oder Passwort ist falsch."
    );
  });

  it("translates existing account errors", () => {
    expect(toGermanAuthError("User already registered")).toBe(
      "Diese E-Mail-Adresse ist bereits registriert. Melde dich an oder setze dein Passwort zurück."
    );
  });

  it("translates expired email links", () => {
    expect(toGermanAuthError("Email link is invalid or has expired")).toBe(
      "Der E-Mail-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an."
    );
  });

  it("uses a German fallback for unknown provider messages", () => {
    expect(toGermanAuthError("Unexpected auth backend message")).toBe(
      "Authentifizierung fehlgeschlagen. Bitte versuche es erneut."
    );
  });
});
