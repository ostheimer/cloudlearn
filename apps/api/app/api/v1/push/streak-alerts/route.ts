import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { sendStreakAlertNotifications } from "@/services/notificationService";

// Cron-triggered endpoint (or manual trigger for testing).
// Protected by CRON_SECRET to prevent unauthorized calls.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const env = getEnv();
    const secret = request.headers.get("x-cron-secret");
    const runtimeEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

    if (env.CRON_SECRET && secret !== env.CRON_SECRET && runtimeEnv !== "development") {
      return jsonError(requestId, "UNAUTHORIZED", "Invalid cron secret", 401);
    }

    const { sent } = await sendStreakAlertNotifications();
    return jsonOk(requestId, { sent });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
