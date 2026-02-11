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

  // Ensure profile row exists (ignore duplicate-key error 23505)
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: user.id });
  if (profileError && profileError.code !== "23505") {
    console.error("[auth] profile upsert error:", profileError.message);
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
