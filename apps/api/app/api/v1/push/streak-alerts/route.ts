import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { secureCompare } from "@/lib/secureCompare";
import { sendStreakAlertNotifications } from "@/services/notificationService";

// Cron-triggered endpoint (or manual trigger for testing).
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
