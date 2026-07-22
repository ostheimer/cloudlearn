import { flashcardListSchema } from "@/lib/contracts";

export type ImportPreviewKind = "scan" | "url" | "pdf";

/**
 * The paid generation cache and the one-shot save receipt deliberately use
 * different namespaces. A client may reuse its generation key when saving;
 * that must never make the save endpoint mistake a preview response for a
 * completed save response.
 */
export function importPreviewReceiptKey(
  userId: string,
  kind: ImportPreviewKind,
  clientKey: string
): string {
  return `import-preview:${userId}:${kind}:${clientKey}`;
}

export function importSaveResultKey(
  userId: string,
  kind: ImportPreviewKind,
  clientKey: string
): string {
  return `import-save:${userId}:${kind}:${clientKey}`;
}

export interface ImportPreviewReceipt {
  cards: ReturnType<typeof flashcardListSchema.parse>;
  savedCount: 0;
}

export function parseImportPreviewReceipt(value: unknown): ImportPreviewReceipt | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { cards?: unknown; savedCount?: unknown };
  if (candidate.savedCount !== 0) return null;
  const cards = flashcardListSchema.safeParse(candidate.cards);
  if (!cards.success) return null;
  return { cards: cards.data, savedCount: 0 };
}
