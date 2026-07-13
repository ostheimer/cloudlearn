import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getStreakCalendar } from "@/lib/db";
import { todayLocal } from "@/lib/localDay";

// GET /api/v1/stats/streak-calendar?month=YYYY-MM — learned days and
// freeze-covered days of one month, for the streak calendar (#237).
// Defaults to the current month in the user's local day (Europe/Berlin).
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const month = request.nextUrl.searchParams.get("month") ?? todayLocal().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return jsonError(requestId, "VALIDATION_ERROR", "month must be formatted YYYY-MM", 400);
    }

    const calendar = await getStreakCalendar(auth.userId, month);
    return jsonOk(requestId, calendar);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
