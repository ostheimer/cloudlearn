import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for secrets (webhook signatures, cron secrets).
 *
 * A plain `===` short-circuits on the first differing character, which lets an
 * attacker recover a secret byte-by-byte from response timing. This helper
 * compares the full UTF-8 buffers via `crypto.timingSafeEqual`.
 *
 * Returns `false` (never throws) when either side is null/undefined/non-string
 * or when the lengths differ — `timingSafeEqual` itself requires equal-length
 * inputs, and revealing only the length is the accepted trade-off.
 */
export function secureCompare(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
