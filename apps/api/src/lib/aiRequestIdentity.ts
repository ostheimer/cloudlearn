import { createHash } from "node:crypto";
import { HttpError } from "./http";

/** Scope client keys to authenticated user + operation; bind them to the input.
 * A separate content fingerprint also joins concurrent requests with new keys.
 */
export function aiRequestIdentity(userId: string, feature: string, body: Record<string, unknown>): { key: string; fingerprint: string } {
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 128) {
    throw new HttpError("Ein gültiger Wiederholungsschlüssel ist erforderlich.", 422, "VALIDATION_ERROR");
  }
  const payload = Object.fromEntries(Object.entries(body).filter(([k]) => k !== "idempotencyKey" && k !== "userId"));
  const digest = (input: unknown) => createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
  const fingerprint = `ai:v1:${digest([userId, feature, payload])}`;
  return { key: `ai:v1:${digest([userId, feature, body.idempotencyKey, payload])}`, fingerprint };
}
function canonical(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonical);
  if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return input;
}
