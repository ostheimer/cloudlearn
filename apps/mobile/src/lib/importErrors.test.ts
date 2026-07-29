import { describe, expect, it } from "vitest";
import { importErrorKey } from "./importErrors";

// Baut denselben Aufbau wie ApiError aus api.ts (Error + status/code), ohne
// api.ts zu importieren — das zieht react-native hinein und ist im Test
// nicht ladbar (gleiches Muster wie importLimits.test.ts).
const apiError = (message: string, status: number, code?: string) =>
  Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

describe("importErrorKey", () => {
  it("übersetzt 'API error 413' je nach Quelle in Bild- bzw. PDF-zu-groß", () => {
    expect(importErrorKey(apiError("API error 413", 413), "image")).toBe(
      "scanError.imageTooLarge"
    );
    expect(importErrorKey(apiError("API error 413", 413), "pdf")).toBe(
      "scanError.pdfTooLarge"
    );
  });

  it("übersetzt die Scan-PDF- und PDF-Verarbeitungs-Codes", () => {
    expect(
      importErrorKey(
        apiError(
          "Die PDF enthält keinen ausreichend extrahierbaren Text. Reine Scan-PDFs werden im MVP noch nicht unterstützt.",
          422,
          "PDF_TEXT_NOT_FOUND"
        ),
        "pdf"
      )
    ).toBe("scanError.pdfNoText");
    expect(importErrorKey(apiError("kaputt", 500, "PDF_IMPORT_FAILED"), "pdf")).toBe(
      "scanError.pdfFailed"
    );
  });

  it("zeigt rohe KI-/Zod-Meldungen nie an, sondern fällt auf den Allgemein-Satz zurück", () => {
    const gemini = apiError('Gemini API error 400 {"error":{"code":400}}', 400);
    expect(importErrorKey(gemini, "image")).toBe("scanError.generic");
    expect(importErrorKey(gemini, "text")).toBe("scanError.generic");
    const zod = apiError('[{"code":"too_big","maximum":20000,"path":["text"]}]', 400);
    expect(importErrorKey(zod, "text")).toBe("scanError.generic");
  });

  it("hat eigene Sätze für URL-Import und Speichern", () => {
    expect(importErrorKey(apiError("API error 502", 502), "url")).toBe("scanError.url");
    expect(importErrorKey(apiError("API error 502", 502), "save")).toBe("scanError.save");
  });

  it("erkennt Netzwerkfehler als 'keine Verbindung'", () => {
    expect(importErrorKey(new TypeError("Network request failed"), "image")).toBe(
      "scanError.offline"
    );
    expect(importErrorKey(new Error("Failed to fetch"), "pdf")).toBe("scanError.offline");
  });

  it("zeigt auch völlig Unbekanntes nie roh an", () => {
    expect(importErrorKey("irgendwas", "text")).toBe("scanError.generic");
    expect(importErrorKey(undefined, "image")).toBe("scanError.generic");
  });
});
