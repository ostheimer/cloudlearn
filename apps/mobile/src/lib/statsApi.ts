// Statistik-Endpunkte als eigenes Modul (#246).
// api.ts wird parallel bearbeitet, deshalb leben die Statistik-Fetches hier:
// Basis-URL + Auth-Header sind bewusst 1:1 das Muster aus src/lib/api.ts
// (getAuthHeaders/request), damit eine spätere Konsolidierung trivial bleibt.
import { supabase } from "./supabase";
import { type StatsResponse } from "./api";

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
    // Continue without auth header — handled below like in api.ts
  }
  return headers;
}

async function requestAuthenticated<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  if (!headers["Authorization"]) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${API_BASE}${path}`, { headers });
  const body = (await res.json().catch(() => null)) as
    | (T & { message?: string })
    | null;

  if (!res.ok || body === null) {
    throw new Error(body?.message ?? `API error ${res.status}`);
  }
  return body;
}

export type StatsWithDuration = StatsResponse & {
  durationMsByDay?: Array<{ date: string; durationMs: number }>;
};

/** GET /api/v1/stats?days=… — globale Statistik (7- oder 30-Tage-Fenster). */
export async function fetchStats(
  days: 7 | 30
): Promise<{ stats: StatsWithDuration }> {
  const body = await requestAuthenticated<{ stats?: StatsWithDuration }>(
    `/api/v1/stats?days=${days}`
  );
  if (!body.stats) {
    throw new Error("Malformed stats response");
  }
  return { stats: body.stats };
}

export interface DeckSummary {
  deckId: string;
  title: string;
  answersTotal: number;
  accuracyRate: number;
}

/** GET /api/v1/stats/decks — Pro-Deck-Zusammenfassungen (letzte 30 Tage). */
export async function fetchDeckSummaries(): Promise<DeckSummary[]> {
  const body = await requestAuthenticated<{ decks?: DeckSummary[] }>(
    "/api/v1/stats/decks"
  );
  return body.decks ?? [];
}

export interface DeckWobblyCard {
  cardId: string;
  front: string;
  back: string;
  wrongCount: number;
  lastWrongAt: string;
}

export interface DeckStats {
  deck: { id: string; title: string };
  answersTotal: number;
  answersCorrect: number;
  accuracyByDay: Array<{ date: string; accuracy: number; count: number }>;
  wobblyCards: DeckWobblyCard[];
}

/** GET /api/v1/decks/:id/stats — Statistik für EIN Deck (letzte 30 Tage). */
export async function fetchDeckStats(deckId: string): Promise<DeckStats> {
  return requestAuthenticated<DeckStats>(
    `/api/v1/decks/${encodeURIComponent(deckId)}/stats`
  );
}
