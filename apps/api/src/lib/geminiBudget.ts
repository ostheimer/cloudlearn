import { createSupabaseAdminClient } from "./supabase";
import { HttpError } from "./http";

export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_MAX_OUTPUT_TOKENS = 16_384;
// Reserve the full model output ceiling, including thinking, and the full input
// ceiling for images. No token-estimation or countTokens provider call can evade
// admission. Text uses one token per UTF-8 byte plus framing headroom.
const MODEL_INPUT_LIMIT = 1_048_576;
const MODEL_OUTPUT_LIMIT = 65_536;

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export function isAiControlError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.code.startsWith("AI_");
}

export async function reserveGeminiBudget(parts: Array<{ text: string } | { inline_data: unknown }>): Promise<string> {
  const inputTokens = parts.some(p => "inline_data" in p)
    ? MODEL_INPUT_LIMIT
    : Math.min(MODEL_INPUT_LIMIT, parts.reduce((n, p) => n + ("text" in p ? Buffer.byteLength(p.text, "utf8") : 0), 1024));
  const db = createSupabaseAdminClient();
  if (!db) throw unavailable();
  let result;
  try {
    result = await db.rpc("reserve_gemini_budget", { p_model: GEMINI_MODEL, p_input_tokens: inputTokens, p_output_tokens: MODEL_OUTPUT_LIMIT });
  } catch { throw unavailable(); }
  if (result.error || !result.data) throw unavailable();
  if (result.data.status === "disabled") throw new HttpError("Die KI-Erstellung ist vorübergehend abgeschaltet. Gespeicherte Karten bleiben lernbar.", 503, "AI_DISABLED");
  if (result.data.status === "exhausted") throw new HttpError("Das gemeinsame KI-Budget ist ausgeschöpft. Bitte versuche es später erneut.", 429, "AI_BUDGET_EXHAUSTED");
  if (result.data.status !== "reserved" || typeof result.data.reservationId !== "string") throw unavailable();
  return result.data.reservationId;
}

export async function settleGeminiBudget(id: string, usage: GeminiUsage | undefined): Promise<void> {
  // Missing/untrusted usage retains the entire hold. A failed network attempt
  // may have been billed too, so it also never frees its reservation.
  if (!usage) return;
  const { promptTokenCount: prompt, candidatesTokenCount: candidates, thoughtsTokenCount: thoughts = 0, totalTokenCount: total } = usage;
  if (![prompt, candidates, thoughts, total].every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)
      || total !== prompt! + candidates! + thoughts) return;
  const db = createSupabaseAdminClient();
  if (!db) throw unavailable();
  let result;
  try {
    result = await db.rpc("settle_gemini_budget", { p_reservation_id: id, p_prompt_tokens: prompt, p_output_tokens: candidates! + thoughts });
  } catch { throw unavailable(); }
  if (result.error || result.data?.status !== "settled") throw unavailable();
}

function unavailable(): HttpError {
  return new HttpError("Die KI-Budgetprüfung ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.", 503, "AI_BUDGET_UNAVAILABLE");
}
