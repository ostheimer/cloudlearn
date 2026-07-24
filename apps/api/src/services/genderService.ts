// Geschlecht fürs Freunde-Wording (Issue #498 Punkt 2): Pflichtangabe bei der
// Registrierung — die Clients zeigen deutsche Beschriftungen, gespeichert wird
// ein stabiles englisches Token. NULL (Bestandskonto ohne Angabe) heißt für
// alle Texte: neutrale Formulierung verwenden.

export const GENDERS = ["female", "male", "diverse"] as const;
export type Gender = (typeof GENDERS)[number];

export type GenderValidation =
  | { ok: true; value: Gender }
  | { ok: false; code: "GENDER_INVALID"; message: string };

export function validateGender(raw: unknown): GenderValidation {
  if (typeof raw === "string" && (GENDERS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as Gender };
  }
  return {
    ok: false,
    code: "GENDER_INVALID",
    message: "Gender must be one of: female, male, diverse",
  };
}
