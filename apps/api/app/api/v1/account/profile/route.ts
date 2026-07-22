import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateDisplayName } from "@/services/displayNameService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { data, error } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", auth.userId)
      .maybeSingle();
    if (error) throw new Error(`account/profile GET: ${error.message}`);

    return jsonOk(requestId, { displayName: data?.display_name ?? null });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function PATCH(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // Namensänderungen sind selten — eine enge Bremse schadet ehrlichen
    // Nutzern nicht und macht Durchprobieren der Sperrliste zäh.
    const allowed = await checkRateLimit(`display-name:${auth.userId}`, 10, 60);
    if (!allowed) {
      return jsonError(requestId, "RATE_LIMITED", "Too many name changes, try again later", 429);
    }

    const body = (await request.json().catch(() => null)) as { displayName?: unknown } | null;
    const result = validateDisplayName(body?.displayName);
    if (!result.ok) {
      return jsonError(requestId, result.code, result.message, 422);
    }

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { error } = await db
      .from("profiles")
      .update({ display_name: result.value })
      .eq("id", auth.userId);
    if (error) throw new Error(`account/profile PATCH: ${error.message}`);

    return jsonOk(requestId, { displayName: result.value });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
