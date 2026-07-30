// Geschlecht fürs Freunde-Wording (Issue #498 Punkt 2): Pflichtangabe bei der
// Registrierung — die Clients zeigen deutsche Beschriftungen, gespeichert wird
// ein stabiles englisches Token. NULL (Bestandskonto ohne Angabe) heißt für
// alle Texte: neutrale Formulierung verwenden.
//
// `prefer_not_to_say` kam mit #609 dazu (Laras Entscheidung 30.07.): Niemand
// soll beim Registrieren etwas Persönliches angeben MÜSSEN. Der Wert ist
// bewusst eigenständig statt NULL — so bleibt unterscheidbar, ob jemand
// bewusst nichts sagen wollte (Pflichtfeld weiterhin erfüllt) oder ob das
// Konto von vor der Abfrage stammt. Für die Texte verhält er sich wie
// `diverse`: neutrale Formulierung.
export const GENDERS = ["female", "male", "diverse", "prefer_not_to_say"] as const;
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
    message: "Gender must be one of: female, male, diverse, prefer_not_to_say",
  };
}
