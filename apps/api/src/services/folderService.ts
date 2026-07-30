import { z } from "zod";
import {
  createFolder,
  listFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  addDeckToFolder,
  removeDeckFromFolder,
  listDecksInFolder,
  countDecksByFolder,
  listCardsInFolder,
  listFoldersForDeck,
  setFolderDeckOrder,
} from "@/lib/db";
import { clampTitle } from "@/lib/titleLimit";

// Freitext von der Nutzerin — gedeckelt, damit niemand über die Beschreibung
// beliebig viel in die Datenbank schreibt. Zwei Sätze passen bequem hinein.
const DESCRIPTION_MAX = 500;

// Titel (#612): trimmen + auf 120 kappen statt abweisen, gleiches Schema wie
// bei Decks (deckService, Begründung in titleLimit.ts).
const titleSchema = z.string().trim().min(1).transform(clampTitle);

const createFolderSchema = z.object({
  userId: z.string().uuid(),
  title: titleSchema,
  parentId: z.string().uuid().optional(),
  color: z.string().optional(),
  description: z.string().max(DESCRIPTION_MAX).optional(),
});

const updateFolderSchema = z.object({
  // Identity is server-controlled: the route always overrides this with the
  // token's user id, so a userId smuggled into the request body is ignored.
  userId: z.string().uuid(),
  folderId: z.string().uuid(),
  title: titleSchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().optional(),
  // `.max()` ohne `.default()` — ein `.default().optional()` würde in zod v4
  // beim PATCH den Wert überschreiben, statt ihn wegzulassen (#355).
  description: z.string().max(DESCRIPTION_MAX).optional(),
});

const reorderSchema = z.object({
  deckIds: z.array(z.string().uuid()).max(500),
});

export async function createFolderForUser(input: unknown) {
  const parsed = createFolderSchema.parse(input);
  return createFolder(parsed.userId, parsed.title, parsed.parentId, parsed.color, parsed.description);
}

export async function listFoldersForUser(userId: string) {
  return listFolders(userId);
}

export async function getFolderById(folderId: string, userId: string) {
  return getFolder(folderId, userId);
}

export async function updateFolderForUser(input: unknown) {
  const parsed = updateFolderSchema.parse(input);
  const updates: Partial<{
    title: string;
    parentId: string | null;
    color: string;
    description: string;
  }> = {};
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.parentId !== undefined) updates.parentId = parsed.parentId;
  if (parsed.color !== undefined) updates.color = parsed.color;
  if (parsed.description !== undefined) updates.description = parsed.description;
  return updateFolder(parsed.folderId, parsed.userId, updates);
}

export async function deleteFolderForUser(folderId: string, userId: string): Promise<boolean> {
  return deleteFolder(folderId, userId);
}

export async function addDeckToFolderForUser(folderId: string, userId: string, deckId: string) {
  return addDeckToFolder(folderId, userId, deckId);
}

export async function removeDeckFromFolderForUser(folderId: string, userId: string, deckId: string) {
  return removeDeckFromFolder(folderId, userId, deckId);
}

export async function listDecksInFolderForUser(folderId: string, userId: string) {
  return listDecksInFolder(folderId, userId);
}

/**
 * Deck-Anzahl je Ordner in einer Antwort (#612) — ersetzt die Anfrage-je-Ordner
 * der Bibliothek und der Ordnerseite. Ordner ohne Decks fehlen im Ergebnis.
 */
export async function countDecksByFolderForUser(userId: string) {
  return countDecksByFolder(userId);
}

/** Alle Karten der Decks eines Ordners (#612). null = nicht der Besitzer → 404. */
export async function listCardsInFolderForUser(folderId: string, userId: string) {
  return listCardsInFolder(folderId, userId);
}

export async function listFoldersForDeckForUser(deckId: string) {
  return listFoldersForDeck(deckId);
}

/** Reihenfolge der Decks in einem Ordner setzen (#437). false = nicht der Besitzer. */
export async function setFolderDeckOrderForUser(
  folderId: string,
  userId: string,
  input: unknown
): Promise<boolean> {
  const parsed = reorderSchema.parse(input);
  return setFolderDeckOrder(folderId, userId, parsed.deckIds);
}
