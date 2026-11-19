import { createHash } from "node:crypto";
import { HttpError } from "./http";

/** Scope client keys to authenticated user + operation; bind them to the input.
 * A separate content fingerprint also joins concurrent requests with new keys.
 */
export function aiRequestIdentity(userId: string, feature: string, body: Record<string, unknown>): { key: string; fingerprint: string } {
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 128) {
    throw new HttpError("Ein gültiger Wiederholungsschlüssel ist erforderlich.", 422, "VALIDATION_ERROR");
  }
  const { idempotencyKey, userId: _requestUser, ...payload } = body;
  if (feature === "urlImport") {
    // URL import always extracts text and skips images.
    delete payload.maxImages;
  }
  if (feature === "aiScan") {
    // Match processScan's image precedence and default MIME type.
    if (payload.imageBase64) {
      delete payload.extractedText;
      payload.imageMimeType ??= "image/jpeg";
    } else {
      delete payload.imageMimeType;
    }
  }
  const digest = (input: unknown) => createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
  const fingerprint = `ai:v1:${digest([userId, feature, payload])}`;
  return { key: `ai:v1:${digest([userId, feature, idempotencyKey, payload])}`, fingerprint };
}
function canonical(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonical);
  if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return input;
}
