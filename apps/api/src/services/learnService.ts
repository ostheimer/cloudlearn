import { countDueCards, listDueCards } from "@/lib/db";

export async function getDueCards(
  userId: string,
  nowIso = new Date().toISOString()
) {
  return listDueCards(userId, nowIso);
}

export async function getDueCardCount(
  userId: string,
  nowIso = new Date().toISOString()
) {
  return countDueCards(userId, nowIso);
}
