import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { secureCompare } from "@/lib/secureCompare";
import { sendStreakAlertNotifications } from "@/services/notificationService";

// Manual/testing trigger — POST with the `x-cron-secret` header.
// Protected by CRON_SECRET to prevent unauthorized calls.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const env = getEnv();
    // No configured secret → refuse in EVERY environment (no development
    // bypass — previously dev/preview accepted any caller).
    if (!env.CRON_SECRET) {
      return jsonError(requestId, "CRON_NOT_CONFIGURED", "Cron secret is not configured", 503);
    }

    const secret = request.headers.get("x-cron-secret");
    if (!secureCompare(secret, env.CRON_SECRET.trim())) {
      return jsonError(requestId, "UNAUTHORIZED", "Invalid cron secret", 401);
    }

    const { sent } = await sendStreakAlertNotifications();
    return jsonOk(requestId, { sent });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

// Scheduled trigger — Vercel Cron sends a GET and (because CRON_SECRET is set
// as an env var) automatically attaches `Authorization: Bearer <CRON_SECRET>`.
// This means the schedule works without the secret ever being handled by us or
// stored in the database — see the `crons` entry in vercel.json.
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const env = getEnv();
    if (!env.CRON_SECRET) {
      return jsonError(requestId, "CRON_NOT_CONFIGURED", "Cron secret is not configured", 503);
    }

    const auth = request.headers.get("authorization");
    if (!secureCompare(auth, `Bearer ${env.CRON_SECRET.trim()}`)) {
      return jsonError(requestId, "UNAUTHORIZED", "Invalid cron secret", 401);
    }

    const { sent } = await sendStreakAlertNotifications();
    return jsonOk(requestId, { sent });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
