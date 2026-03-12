import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const registerPushSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["ios", "android", "web"]),
});

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = registerPushSchema.safeParse(await request.json());
    if (!body.success) return jsonError(requestId, "INVALID_REQUEST", body.error.message, 400);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    await db.from("push_tokens").upsert(
      {
        user_id: auth.userId,
        token: body.data.token,
        platform: body.data.platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

    return jsonOk(requestId, { registered: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
