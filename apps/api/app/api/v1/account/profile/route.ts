import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateDisplayName } from "@/services/displayNameService";
import { validateGender, type Gender } from "@/services/genderService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { data, error } = await db
      .from("profiles")
      .select("display_name, gender")
      .eq("id", auth.userId)
      .maybeSingle();
    if (error) throw new Error(`account/profile GET: ${error.message}`);

    return jsonOk(requestId, {
      displayName: data?.display_name ?? null,
      gender: (data?.gender as Gender | null) ?? null,
    });
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

    // Profiländerungen sind selten — eine enge Bremse schadet ehrlichen
    // Nutzern nicht und macht Durchprobieren der Namens-Sperrliste zäh.
    // (Schlüssel bleibt "display-name", damit laufende Fenster weiterzählen.)
    const allowed = await checkRateLimit(`display-name:${auth.userId}`, 10, 60);
    if (!allowed) {
      return jsonError(requestId, "RATE_LIMITED", "Too many profile changes, try again later", 429);
    }

    const body = (await request.json().catch(() => null)) as {
      displayName?: unknown;
      gender?: unknown;
    } | null;

    const wantsName = body?.displayName !== undefined;
    const wantsGender = body?.gender !== undefined;
    if (!wantsName && !wantsGender) {
      return jsonError(requestId, "NO_FIELDS", "Nothing to update", 422);
    }

    const update: { display_name?: string; gender?: Gender } = {};
    if (wantsName) {
      const result = validateDisplayName(body?.displayName);
      if (!result.ok) {
        return jsonError(requestId, result.code, result.message, 422);
      }
      update.display_name = result.value;
    }
    if (wantsGender) {
      const result = validateGender(body?.gender);
      if (!result.ok) {
        return jsonError(requestId, result.code, result.message, 422);
      }
      update.gender = result.value;
    }

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { data, error } = await db
      .from("profiles")
      .update(update)
      .eq("id", auth.userId)
      .select("display_name, gender")
      .maybeSingle();
    if (error) throw new Error(`account/profile PATCH: ${error.message}`);

    return jsonOk(requestId, {
      displayName: data?.display_name ?? null,
      gender: (data?.gender as Gender | null) ?? null,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
