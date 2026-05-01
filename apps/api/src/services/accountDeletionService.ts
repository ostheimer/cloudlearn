import { createSupabaseAdminClient } from "@/lib/supabase";

function getDb() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return client;
}

function isMissingAuthUserError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: unknown; message?: unknown };
  return (
    maybeError.status === 404 ||
    (typeof maybeError.message === "string" && maybeError.message.toLowerCase().includes("user not found"))
  );
}

export interface DeleteAccountResult {
  deleted: true;
  warning?: string;
  message: string;
}

export async function deleteAccount(userId: string, email: string): Promise<DeleteAccountResult> {
  const db = getDb();

  const { error: cleanupError } = await db.rpc("delete_account_data", {
    target_user_id: userId,
    target_email: email || null,
  });
  if (cleanupError) {
    throw new Error(`deleteAccount cleanup: ${cleanupError.message}`);
  }

  const { error: authDeleteError } = await db.auth.admin.deleteUser(userId);
  if (authDeleteError && !isMissingAuthUserError(authDeleteError)) {
    console.error("[accountDeletion] auth delete pending:", authDeleteError.message);
    return {
      deleted: true,
      warning:
        "Die Lerninhalte wurden gelöscht, aber die technische Auth-Löschung ist noch offen. Der Account ist im App-Pfad bereits gesperrt.",
      message: "Account und Lerninhalte wurden endgültig gelöscht.",
    };
  }

  return {
    deleted: true,
    message: "Account und Lerninhalte wurden endgültig gelöscht.",
  };
}
