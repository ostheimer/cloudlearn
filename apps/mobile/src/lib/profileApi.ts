// Profil-Endpunkte als eigenes Modul: api.ts wird parallel bearbeitet (LP-/Hot-
// Session), deshalb lebt der Tagesziel-Setter hier. Basis-URL + Auth-Header sind
// bewusst 1:1 das Muster aus statsApi.ts (getAuthHeaders/Bearer-Token via
// supabase.auth.getSession()), damit eine spätere Konsolidierung trivial bleibt.
import { supabase } from "./supabase";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "https://clearn-api.vercel.app";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Continue without auth header — handled below like in statsApi.ts
  }
  return headers;
}

/**
 * PATCH /api/v1/daily-goal — set how many cards/day the user aims to review.
 * The server owns the clamp ([1, 500]) and returns the value it stored; the
 * user's identity comes from the auth token, never from the body.
 */
export async function setDailyGoal(goal: number): Promise<{ dailyGoal: number }> {
  const headers = await getAuthHeaders();
  if (!headers["Authorization"]) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}/api/v1/daily-goal`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ dailyGoal: goal }),
  });
  const body = (await res.json().catch(() => null)) as
    | { dailyGoal?: number; message?: string }
    | null;

  if (!res.ok || body === null) {
    throw new Error(body?.message ?? `API error ${res.status}`);
  }
  return { dailyGoal: body.dailyGoal ?? goal };
}
