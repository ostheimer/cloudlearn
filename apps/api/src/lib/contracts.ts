import { z } from "zod";

export const cardTypeSchema = z.enum(["basic", "cloze", "mcq", "matching", "occlusion"]);
export type CardType = z.infer<typeof cardTypeSchema>;

// Ob eine Karte Lückentext ist, entscheidet ihr TEXT, nicht ein vom Client
// gesetztes Etikett. Eine Lücke gibt es in zwei Schreibweisen: {{cN::…}} mit
// eingebetteter Antwort (Anki-Stil, liest apps/mobile/app/cloze.tsx) und
// ______-Unterstriche mit der Antwort auf der Rückseite (so erzeugt sie der
// Scan). Die Muster sind dieselben, mit denen Quiz/Test Fill-in-Karten
// erkennen (quizQuestions.ts) — ein abweichendes Etikett verfälscht dort nur
// die Distraktoren-Gruppierung (#380). Deshalb wird die Achse basic↔cloze
// serverseitig abgeleitet. Spezialtypen (mcq, matching, occlusion) tragen
// keine Markierung und bleiben unverändert.
const CLOZE_MARKER = /\{\{c\d+::.+?\}\}/;
const BLANK_MARKER = /_{2,}/;

export function deriveCardType(front: string, requested: CardType = "basic"): CardType {
  if (requested !== "basic" && requested !== "cloze") return requested;
  return CLOZE_MARKER.test(front) || BLANK_MARKER.test(front) ? "cloze" : "basic";
}
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
// Tag rules without a default, so partial-update schemas can reuse the validation
// without inheriting flashcardSchema's `.default([])` — see updateCardSchema.
export const cardTagsSchema = z.array(z.string().min(1).max(40)).max(10);

// One rectangular occlusion region on the card image (percent 0-1).
export const occlusionRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  label: z.string().max(200),
});

export const flashcardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1000),
  type: cardTypeSchema.default("basic"),
  difficulty: difficultySchema.default("medium"),
  tags: cardTagsSchema.default([]),
  // Storage path of the card image (Occlusion & future image cards).
  sourceImageUrl: z.string().max(1000).optional(),
  // Free-form per-card data. For Occlusion: { regions: OcclusionRegion[], hideIndex: number }.
  extraData: z.record(z.string(), z.unknown()).optional(),
});

export type Flashcard = z.infer<typeof flashcardSchema>;

// Long study material is generated chunk by chunk (see studyTextChunks.ts), so
// one import legitimately produces far more than the 50 a single call returned:
// an 18k-character PIT chapter yields ~60 cards, a 42k one ~120. This schema
// THROWS above its max rather than truncating, so a cap set too low turns a
// better import into a failed one. 150 sits above the largest measured import
// while still rejecting a runaway response.
export const MAX_GENERATED_CARDS = 150;
export const flashcardListSchema = z.array(flashcardSchema).min(1).max(MAX_GENERATED_CARDS);

/**
 * „Erzeuge die Karten, speichere sie aber noch nicht" (#427).
 *
 * Damit kann der Client sie erst zeigen, bearbeiten und einzeln verwerfen
 * lassen und danach über `POST /api/v1/import/save` ablegen. Die Lernpunkte
 * kostet trotzdem die Erzeugung — die KI hat gearbeitet, ob gespeichert wird
 * oder nicht. Voreinstellung ist `false`, damit jeder bestehende Client
 * unverändert weiterläuft.
 */
const previewFlag = z.boolean().default(false);

export const scanProcessRequestSchema = z.object({
  userId: z.string().uuid(),
  extractedText: z.string().min(1).max(20_000).optional(),
  imageBase64: z.string().min(100).max(10_000_000).optional(),
  imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  sourceImageUrl: z.string().url().optional(),
  deckId: z.string().uuid().optional(),
  preview: previewFlag,
}).refine(
  (data) => Boolean(data.extractedText) || Boolean(data.imageBase64),
  { message: "Either extractedText or imageBase64 must be provided" }
);

// #411: `cards` are the cards that were really saved. `generatedCount` says how
// much the model found — if the two differ, the deck hit its plan limit and the
// import was thinned out evenly over the whole material. Optional so results
// cached before this change still fit the type.
const importCountFields = {
  generatedCount: z.number().int().nonnegative().optional(),
  savedCount: z.number().int().nonnegative().optional(),
};

export const scanProcessResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional(),
  ...importCountFields,
});

export type ScanProcessResponse = z.infer<typeof scanProcessResponseSchema>;

export const urlImportRequestSchema = z.object({
  userId: z.string().uuid(),
  sourceUrl: z.string().url(),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  maxImages: z.number().int().min(0).max(8).default(4),
  deckId: z.string().uuid().optional(),
  preview: previewFlag,
});

export type UrlImportRequest = z.infer<typeof urlImportRequestSchema>;

export const urlImportResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional(),
  sourceUrl: z.string().url(),
  imagesUsed: z.number().int().nonnegative().default(0),
  ...importCountFields,
});

export type UrlImportResponse = z.infer<typeof urlImportResponseSchema>;

export const reviewRatingSchema = z.enum(["again", "hard", "good", "easy"]);
export type ReviewRating = z.infer<typeof reviewRatingSchema>;

/**
 * Aus welchem Modus eine Wiederholung stammt. Nötig, weil ein Eintrag heute
 * fünf Dinge gleichzeitig schaltet (Lernplan, LP, Streak, Tagesziel, Statistik)
 * und die Regeln je Modus auseinandergehen.
 *
 * Nur eine Produktangabe, KEINE Sicherheitsgrenze: der Client bestimmt sie und
 * könnte auch "flashcard" behaupten. Die tragende Verteidigung bleibt die
 * Tageskappe.
 */
export const reviewModeSchema = z.enum([
  "flashcard",
  "practice",
  "cloze",
  "occlusion",
  "quiz",
  "match",
  "test",
]);

export const reviewRequestSchema = z.object({
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  rating: reviewRatingSchema,
  reviewedAt: z.string().datetime(),
  reviewDurationMs: z.number().int().nonnegative().max(120_000).optional(),
  idempotencyKey: z.string().min(8).max(128),
  // .default() OHNE .optional() — die Kombination war die Falle in #355: der
  // Default greift dann nicht mehr und der Wert wird undefined. Alte Clients
  // schicken kein mode; sie sollen als "flashcard" ankommen, weil sie
  // ausschließlich aus zählenden Modi schreiben.
  mode: reviewModeSchema.default("flashcard"),
});

export const fsrsStateSchema = z.enum(["new", "learning", "review", "relearning"]);

export const reviewResponseSchema = z.object({
  requestId: z.string().min(8),
  cardId: z.string().uuid(),
  nextDueAt: z.string().datetime(),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  state: fsrsStateSchema
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export const operationTypeSchema = z.enum(["review", "card_update", "deck_update", "delete"]);

export const syncOperationSchema = z.object({
  operationId: z.string().min(8).max(128),
  operationType: operationTypeSchema,
  createdAt: z.string().datetime(),
  payload: z.union([
    reviewRequestSchema,
    z.object({ cardId: z.string().uuid(), front: z.string().min(1), back: z.string().min(1) }),
    z.object({ deckId: z.string().uuid(), title: z.string().min(1) }),
    z.object({ entity: z.enum(["card", "deck"]), entityId: z.string().uuid() })
  ])
});

export const syncRequestSchema = z.object({
  userId: z.string().uuid(),
  operations: z.array(syncOperationSchema).max(500)
});

export const syncResponseSchema = z.object({
  requestId: z.string().min(8),
  acceptedOperationIds: z.array(z.string()),
  // „Abgelehnt" heißt ENDGÜLTIG: dieser Eintrag wird nie gutgehen (kaputte
  // Daten, gelöschte Karte). Clients dürfen ihn wegwerfen.
  rejectedOperationIds: z.array(z.string()),
  // Vorübergehend gescheitert — Datenbank kurz weg, Zeitüberschreitung,
  // Unbekanntes. Bewusst ein EIGENES Feld: Läge das in rejectedOperationIds,
  // würden Clients offline gelernte Antworten wegen eines Aussetzers endgültig
  // löschen (#418). Alte Builds kennen das Feld nicht — deshalb antwortet der
  // Sync mit 503 auf den ganzen Aufruf, wenn AUSSCHLIESSLICH vorübergehende
  // Fehler auftraten (siehe syncService).
  failedOperationIds: z.array(z.string()),
  serverTimestamp: z.string().datetime()
});

export type SyncResponse = z.infer<typeof syncResponseSchema>;

export const subscriptionTierSchema = z.enum(["free", "pro", "lifetime"]);
export const subscriptionStatusSchema = z.object({
  userId: z.string().uuid(),
  tier: subscriptionTierSchema,
  isActive: z.boolean(),
  expiresAt: z.string().datetime().nullable()
});

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const lpEarnRequestSchema = z.object({
  // Only "session" remains. "dailyGoal" and "ad" were retired as client-asserted
  // self-grants: "ad" now requires AdMob Server-Side Verification (Google → server),
  // granted via a dedicated SSV endpoint, not this JWT route (#149).
  type: z.enum(["session"]),
  // Accepted for backward compatibility with shipped clients, but ignored server-side:
  // the "session" grant is derived from server-recorded reviews, not this count.
  sessionCardCount: z.number().int().optional(),
});
export type LpEarnRequest = z.infer<typeof lpEarnRequestSchema>;

export const lpSpendRequestSchema = z.object({
  feature: z.enum(["aiScan", "urlImport", "pdfImport"]),
});
export type LpSpendRequest = z.infer<typeof lpSpendRequestSchema>;

export const revenueCatWebhookSchema = z.object({
  event: z.object({
    app_user_id: z.string(),
    type: z.string(),
    entitlement_ids: z.array(z.string()).optional(),
    expiration_at_ms: z.number().int().nullable().optional(),
    // Fields present for one-time purchases (consumable LP packs)
    product_id: z.string().optional(),
    transaction_id: z.string().optional(),
    store_transaction_id: z.string().optional(),
  })
});

export type RevenueCatWebhook = z.infer<typeof revenueCatWebhookSchema>;

export const betaFeedbackSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(["in_app", "email", "interview"]).default("in_app"),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(3).max(5000),
  category: z.enum(["bug", "ux", "feature", "performance", "other"]).default("other")
});

export type BetaFeedback = z.infer<typeof betaFeedbackSchema>;

export const pdfImportRequestSchema = z.object({
  userId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileBase64: z.string().min(100).max(20_000_000),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  deckId: z.string().uuid().optional(),
  preview: previewFlag,
});

export type PdfImportRequest = z.infer<typeof pdfImportRequestSchema>;

export const pdfImportResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional(),
  fileName: z.string().min(1).max(200),
  pageCount: z.number().int().positive(),
  extractedCharacters: z.number().int().positive(),
  ...importCountFields,
});

export type PdfImportResponse = z.infer<typeof pdfImportResponseSchema>;

export const pdfImportJobSchema = z.object({
  jobId: z.string().min(8),
  userId: z.string().uuid(),
  fileName: z.string().min(1),
  pageCount: z.number().int().positive(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  retries: z.number().int().nonnegative().default(0)
});

export type PdfImportJob = z.infer<typeof pdfImportJobSchema>;

/**
 * Der zweite Halbschritt zu `preview` (#427): Karten ablegen, die vorher schon
 * erzeugt und bezahlt wurden.
 *
 * Kostet KEINE Lernpunkte — die sind bei der Erzeugung geflossen. Die Karten
 * kommen vom Client und dürfen bearbeitet oder ausgedünnt sein; deshalb werden
 * sie hier genauso geprüft wie frisch erzeugte. Ohne `deckId` entsteht ein
 * neues Deck mit `title`, mit `deckId` wird angehängt — dieselben Tarifgrenzen
 * wie beim direkten Import (`reserveImportTarget`).
 */
export const importSaveRequestSchema = z.object({
  userId: z.string().uuid(),
  cards: flashcardListSchema,
  deckId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(100).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export type ImportSaveRequest = z.infer<typeof importSaveRequestSchema>;

export const importSaveResponseSchema = z.object({
  requestId: z.string().min(8),
  deckId: z.string().uuid(),
  deckTitle: z.string().min(1).max(100),
  cards: flashcardListSchema,
  ...importCountFields,
});

export type ImportSaveResponse = z.infer<typeof importSaveResponseSchema>;
