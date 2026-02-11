import { listDueCards } from "@/lib/db";

export async function getDueCards(
  userId: string,
  nowIso = new Date().toISOString()
) {
  return listDueCards(userId, nowIso);
}
