import { type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "./supabase";

/**
 * Extract and verify JWT from Authorization header.
 * Ensures a profile row exists for the authenticated user.
 * Returns null if no valid token is present.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<{ userId: string; email: string } | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  // Deleted accounts are blocked from being rehydrated into a new profile.
  // This prevents a stale auth session from recreating the app profile row.
  const { data: deletedAccount, error: deletedAccountError } = await supabase
    .from("deleted_accounts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (deletedAccountError) {
    const deletedAccountErrorWithCode = deletedAccountError as Error & { code?: string };
    if (deletedAccountErrorWithCode.code !== "42P01") {
      console.error("[auth] deleted_accounts lookup error:", deletedAccountError.message);
    }
  }
  if (deletedAccount) return null;

  // Ensure profile row exists — idempotent, no error/log noise if it already exists.
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
  if (profileError) {
    console.error("[auth] ensure-profile error:", profileError.message);
  }

  return { userId: user.id, email: user.email ?? "" };
}

/**
 * Require authentication — returns user or throws.
 * Use in routes that MUST be authenticated.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string; email: string }> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError("Authentication required");
  }
  return user;
}

export class AuthError extends Error {
  public status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
