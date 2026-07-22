/**
 * Anzeigename: Validierung + Inhaltsfilter (Etappe 1 des Namens-Features).
 *
 * Die Prüfung lebt bewusst auf dem Server: Clients (App/Web) rufen den
 * Endpunkt PATCH /api/v1/account/profile auf, der direkte PostgREST-Schreibweg
 * auf profiles.display_name ist per Migration entzogen. Nur so gilt der Filter
 * für jeden Weg gleichermaßen.
 *
 * Der Filter arbeitet auf einer normalisierten Form (Kleinbuchstaben, Akzente
 * entfernt, Leetspeak aufgelöst: "1d1ot" → "idiot"), damit Trick-Schreibweisen
 * nicht durchrutschen. Zwei Listen mit unterschiedlicher Härte:
 *
 * - BLOCKED_SUBSTRINGS: Begriffe, die in keinem harmlosen Namen vorkommen —
 *   werden überall im Namen gefunden, auch eingebettet ("XxHitlerxX").
 * - BLOCKED_WORDS: Begriffe, die als Teil harmloser Wörter vorkommen können
 *   ("ass" in "Klasse", "anal" in "Kanal") — zählen nur als ganzes Wort.
 *
 * Kein Filter fängt alles; die Listen sind bewusst wartbar gehalten und
 * decken den Schul-Kontext streng ab (Beleidigungen, Sexuelles, Drogen,
 * Hass-Begriffe, Links). Erweiterungen: einfach Einträge ergänzen — immer in
 * der normalisierten Form (klein, ohne Umlaute: "arschlöcher" → "arschlocher").
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

export type DisplayNameError =
  | "DISPLAY_NAME_TOO_SHORT"
  | "DISPLAY_NAME_TOO_LONG"
  | "DISPLAY_NAME_INVALID_CHARS"
  | "DISPLAY_NAME_NOT_ALLOWED";

export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; code: DisplayNameError; message: string };

/** Überall im Namen verboten, auch eingebettet. Nur normalisierte Kleinform. */
const BLOCKED_SUBSTRINGS: readonly string[] = [
  // Hass & Extremismus
  "hitler",
  "nazi",
  "judensau",
  "nigger",
  "nigga",
  "neger",
  "kanake",
  "schwuchtel",
  // Grobe Beleidigungen (deutsch)
  "hurensohn",
  "hurentochter",
  "missgeburt",
  "arschloch",
  "drecksau",
  "fotze",
  "wichser",
  "wixer",
  "wixxer",
  "schlampe",
  "nutte",
  "spasti",
  "vollpfosten",
  "hackfresse",
  // Grobe Beleidigungen (englisch)
  "fuck",
  "bitch",
  "cunt",
  "faggot",
  "retard",
  "whore",
  "asshole",
  "motherfucker",
  "wanker",
  "bastard",
  // Sexuelles
  "porno",
  "penis",
  "vagina",
  "masturb",
  "orgasmus",
  "dildo",
  "blowjob",
  "muschi",
  "titten",
  "pussy",
  "fick",
  "shit",
  // Drogen
  "heroin",
  "kokain",
  "cannabis",
  "crystalmeth",
  "methamphetamin",
  // Links haben in Namen nichts verloren
  "http",
  "www",
];

/**
 * Nur als ganzes Wort verboten — eingebettet sind sie Teil harmloser Wörter
 * ("ass" in "Klasse", "anal" in "Kanal", "cock" in "Cocktail", "sau" in
 * "Saubermann"). "schwul"/"lesbe" stehen hier nicht, weil die Wörter schlimm
 * wären, sondern weil Namen wie "XY ist schwul" ein Mobbing-Vehikel sind.
 */
const BLOCKED_WORDS: readonly string[] = [
  "idiot",
  "depp",
  "trottel",
  "spast",
  "behindert",
  "dummkopf",
  "loser",
  "opfer",
  "hure",
  "sau",
  "schwein",
  "arsch",
  "kacke",
  "scheisse",
  "scheiss",
  "penner",
  "assi",
  "asozial",
  "fresse",
  "schwul",
  "lesbe",
  "sex",
  "anal",
  "cock",
  "dick",
  "ass",
  "tits",
  "boobs",
  "hoe",
  "koks",
  "gras",
  "weed",
];

/**
 * Kleinschreibung, Akzente weg (ö→o, é→e), ß→ss, Leetspeak auflösen.
 * Ergebnis enthält nur noch a-z plus Trennzeichen.
 */
export function normalizeForFilter(input: string): string {
  return input
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[@4]/g, "a")
    .replace(/[3€]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/[2]/g, "z")
    .replace(/[^a-z]+/gu, " ")
    .trim();
}

function isBlocked(name: string): boolean {
  const normalized = normalizeForFilter(name);
  // Kompaktform ohne Trennzeichen fängt "A r s c h l o c h" und "XxFickxX".
  const compact = normalized.replace(/ /g, "");
  if (BLOCKED_SUBSTRINGS.some((term) => compact.includes(term))) return true;

  // Wort-Begriffe: als ganzes Wort — oder als kompletter Name in
  // Trenn-Schreibweise ("I d i o t" → kompakt "idiot").
  if (BLOCKED_WORDS.includes(compact)) return true;
  const words = normalized.split(" ").filter(Boolean);
  return BLOCKED_WORDS.some((term) => words.includes(term));
}

/**
 * Prüft und säubert einen gewünschten Anzeigenamen.
 * Bei Erfolg kommt der bereinigte Wert zurück (getrimmt, Mehrfach-Leerzeichen
 * zusammengezogen) — GENAU dieser Wert gehört in die Datenbank.
 */
export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== "string") {
    return {
      ok: false,
      code: "DISPLAY_NAME_TOO_SHORT",
      message: `Display name must be a string of at least ${DISPLAY_NAME_MIN} characters`,
    };
  }

  const value = raw.replace(/\s+/g, " ").trim();

  if (value.length < DISPLAY_NAME_MIN) {
    return {
      ok: false,
      code: "DISPLAY_NAME_TOO_SHORT",
      message: `Display name must have at least ${DISPLAY_NAME_MIN} characters`,
    };
  }
  if (value.length > DISPLAY_NAME_MAX) {
    return {
      ok: false,
      code: "DISPLAY_NAME_TOO_LONG",
      message: `Display name must have at most ${DISPLAY_NAME_MAX} characters`,
    };
  }
  // Lateinische Buchstaben (inkl. Umlaute), Ziffern, Leerzeichen und . - _ '
  // — und mindestens ein Buchstabe, damit "12345" kein Name ist.
  if (!/^[\p{Script=Latin}\p{N} .\-_']+$/u.test(value) || !/\p{Script=Latin}/u.test(value)) {
    return {
      ok: false,
      code: "DISPLAY_NAME_INVALID_CHARS",
      message: "Display name may only contain letters, numbers, spaces and . - _ '",
    };
  }
  if (isBlocked(value)) {
    return {
      ok: false,
      code: "DISPLAY_NAME_NOT_ALLOWED",
      message: "This display name is not allowed",
    };
  }

  return { ok: true, value };
}
