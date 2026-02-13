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
  listFoldersForDeck,
} from "@/lib/db";

const createFolderSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  parentId: z.string().uuid().optional(),
  color: z.string().optional(),
});

const updateFolderSchema = z.object({
  folderId: z.string().uuid(),
  title: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().optional(),
});

export async function createFolderForUser(input: unknown) {
  const parsed = createFolderSchema.parse(input);
  return createFolder(parsed.userId, parsed.title, parsed.parentId, parsed.color);
}

export async function listFoldersForUser(userId: string) {
  return listFolders(userId);
}

export async function getFolderById(folderId: string) {
  return getFolder(folderId);
}

export async function updateFolderForUser(input: unknown) {
  const parsed = updateFolderSchema.parse(input);
  const updates: Partial<{ title: string; parentId: string | null; color: string }> = {};
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.parentId !== undefined) updates.parentId = parsed.parentId;
  if (parsed.color !== undefined) updates.color = parsed.color;
  return updateFolder(parsed.folderId, updates);
}

export async function deleteFolderForUser(folderId: string): Promise<boolean> {
  return deleteFolder(folderId);
}

export async function addDeckToFolderForUser(folderId: string, deckId: string) {
  return addDeckToFolder(folderId, deckId);
}

export async function removeDeckFromFolderForUser(folderId: string, deckId: string) {
  return removeDeckFromFolder(folderId, deckId);
}

export async function listDecksInFolderForUser(folderId: string) {
  return listDecksInFolder(folderId);
}

export async function listFoldersForDeckForUser(deckId: string) {
  return listFoldersForDeck(deckId);
}
