/**
 * Day boundaries for streaks, daily LP limits and reminders follow the user's
 * local day, not UTC (#211). The user base is German; profiles default to
 * Europe/Berlin, so a fixed zone is deliberate until per-user timezones are
 * wired through.
 */

export const USER_TIMEZONE = "Europe/Berlin";

/** Current calendar date (YYYY-MM-DD) in the user timezone. */
export function todayLocal(now: Date = new Date()): string {
  // sv-SE renders dates as YYYY-MM-DD.
  return now.toLocaleDateString("sv-SE", { timeZone: USER_TIMEZONE });
}

/** Whole days from date `a` to date `b` (both YYYY-MM-DD); positive if b is later. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1) -
      Date.UTC(ay ?? 0, (am ?? 1) - 1, ad ?? 1)) /
      86_400_000
  );
}

/** Zone offset (minutes ahead of UTC) of USER_TIMEZONE at a given instant. */
function offsetMinutesAt(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: USER_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) parts[p.type] = p.value;
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute)
  );
  return Math.round((wallAsUtc - at.getTime()) / 60_000);
}

/** Start of the current local calendar day, as an ISO timestamp (UTC instant). */
export function startOfTodayLocalIso(now: Date = new Date()): string {
  const day = todayLocal(now);
  const [y, m, d] = day.split("-").map(Number);
  const dayUtcMidnight = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  // Local midnight = UTC midnight of that date minus the zone offset. Compute
  // twice so DST-switch days use the offset that applies at midnight itself.
  let candidate = new Date(dayUtcMidnight - offsetMinutesAt(now) * 60_000);
  candidate = new Date(dayUtcMidnight - offsetMinutesAt(candidate) * 60_000);
  return candidate.toISOString();
}
