/**
 * Which "Weitermachen" entry counts: the one from this device or the one from
 * the account? (#610 — mirror of apps/web/src/lib/progress-merge.ts, both
 * platforms must decide identically.)
 *
 * Both can be usable and still mean different positions — exactly when the
 * learner studied on another device in between. The NEWER one wins: it knows
 * the cards that were really rated last, and re-rating those is precisely what
 * this feature prevents.
 *
 * An entry without a stamp predates the field and counts as older than any
 * stamped one — which is true, since both sides stamp from the same version on.
 */

export interface TimestampedProgress {
  savedAt?: string | undefined;
}

/** Milliseconds of a stamp; -1 for missing or unreadable. */
function stampOf(entry: TimestampedProgress | null): number {
  if (!entry?.savedAt) return -1;
  const ms = new Date(entry.savedAt).getTime();
  return Number.isFinite(ms) ? ms : -1;
}

/**
 * Pick the authoritative entry. Either side may be null (nothing stored, no
 * network, storage locked); on a tie the account entry wins, because it is the
 * cross-device view.
 */
export function pickNewerProgress<L extends TimestampedProgress, S extends TimestampedProgress>(
  local: L | null,
  server: S | null
): L | S | null {
  if (!local) return server;
  if (!server) return local;
  return stampOf(local) > stampOf(server) ? local : server;
}
