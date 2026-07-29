/**
 * Verständliche Fehlermeldungen für den Scan-Bildschirm (#609).
 *
 * Rohe Servermeldungen ("Gemini API error 400 {…}", Zod-Prüfberichte,
 * "API error 413") erreichen Lara nie mehr: Jeder Fehler wird auf einen
 * i18n-Schlüssel abgebildet (Wortlaute in resources.ts, de und en), und
 * unbekannte Fälle landen im freundlichen Allgemein-Satz statt im Rohtext.
 * Die Lernpunkte- und Tarif-Fälle behandelt der Aufrufer VOR diesem Helfer
 * (shouldOpenLpModal / isPlanLimitError) — hier kommt nur der Rest an.
 *
 * Wie importLimits.ts prüft dies die Fehlerform strukturell (status/code)
 * statt ApiError aus api.ts zu importieren — api.ts zieht react-native
 * hinein, und das lässt sich in Unit-Tests nicht laden.
 */
export type ImportSource = "image" | "pdf" | "text" | "url" | "save";

export const IMPORT_ERROR_TITLE_KEY = "scanError.title";

type ErrorLike = { status?: unknown; code?: unknown };

function asErrorLike(error: unknown): { status?: number; code?: string } {
  if (typeof error !== "object" || error === null) return {};
  const candidate = error as ErrorLike;
  return {
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
  };
}

export function importErrorKey(error: unknown, source: ImportSource): string {
  const { status, code } = asErrorLike(error);

  // Zu große Sendung (meist Vercel-413 ohne JSON-Körper → "API error 413").
  if (status === 413) {
    if (source === "image") return "scanError.imageTooLarge";
    if (source === "pdf") return "scanError.pdfTooLarge";
  }
  if (code === "PDF_TEXT_NOT_FOUND") return "scanError.pdfNoText";
  if (code === "PDF_IMPORT_FAILED") return "scanError.pdfFailed";

  // Netzwerkfehler: fetch wirft in React Native einen TypeError
  // ("Network request failed"), im Browser "Failed to fetch".
  if (
    status === undefined &&
    (error instanceof TypeError ||
      (error instanceof Error && /network|fetch/i.test(error.message)))
  ) {
    return "scanError.offline";
  }

  if (source === "url") return "scanError.url";
  if (source === "save") return "scanError.save";
  return "scanError.generic";
}
