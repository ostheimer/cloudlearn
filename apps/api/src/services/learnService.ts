import { listDueCards } from "@/lib/inMemoryStore";

export function getDueCards(userId: string, nowIso = new Date().toISOString()) {
  return listDueCards(userId, nowIso);
}
