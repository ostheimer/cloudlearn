import { adviceForLimit } from "./importLimits";

/** Nutzerfreundlicher Fehlertext für den gemeinsamen Karteneditor. */
export function cardEditorErrorMessage(error: unknown): string {
  return adviceForLimit(error) ?? "Speichern fehlgeschlagen. Bitte versuche es erneut.";
}
