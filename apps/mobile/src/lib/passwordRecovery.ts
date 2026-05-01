import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";

const PASSWORD_RECOVERY_KEY = "clearn_pending_password_recovery";
const HANDLED_PASSWORD_RECOVERY_SESSION_KEY =
  "clearn_handled_password_recovery_session";
const PASSWORD_RECOVERY_TTL_MS = 2 * 60 * 60 * 1000;

interface PendingPasswordRecovery {
  createdAt: number;
}

interface RecoveryJwtPayload {
  amr?: Array<{ method?: string }>;
  session_id?: string;
}

function decodeBase64UrlJson(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let index = 0;

  while (index < padded.length) {
    const encoded1 = chars.indexOf(padded.charAt(index++));
    const encoded2 = chars.indexOf(padded.charAt(index++));
    const encoded3 = chars.indexOf(padded.charAt(index++));
    const encoded4 = chars.indexOf(padded.charAt(index++));

    const char1 = (encoded1 << 2) | (encoded2 >> 4);
    const char2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const char3 = ((encoded3 & 3) << 6) | encoded4;

    output += String.fromCharCode(char1);
    if (encoded3 !== 64) {
      output += String.fromCharCode(char2);
    }
    if (encoded4 !== 64) {
      output += String.fromCharCode(char3);
    }
  }

  return JSON.parse(output);
}

export function getPasswordRecoverySessionId(
  session: Pick<Session, "access_token"> | null
): string | null {
  if (!session?.access_token) {
    return null;
  }

  const [, rawPayload] = session.access_token.split(".");
  if (!rawPayload) {
    return null;
  }

  try {
    const payload = decodeBase64UrlJson(rawPayload) as RecoveryJwtPayload;
    const hasRecoveryMethod = payload.amr?.some(
      (entry) => entry.method === "recovery"
    );

    if (!hasRecoveryMethod) {
      return null;
    }

    return payload.session_id ?? session.access_token;
  } catch {
    return null;
  }
}

export function isPasswordRecoverySession(
  session: Pick<Session, "access_token"> | null
): boolean {
  return Boolean(getPasswordRecoverySessionId(session));
}

export async function hasHandledPasswordRecoverySession(
  session: Pick<Session, "access_token"> | null
): Promise<boolean> {
  const recoverySessionId = getPasswordRecoverySessionId(session);
  if (!recoverySessionId) {
    return false;
  }

  const handledSessionId = await AsyncStorage.getItem(
    HANDLED_PASSWORD_RECOVERY_SESSION_KEY
  );
  return handledSessionId === recoverySessionId;
}

export async function markPasswordRecoverySessionHandled(
  session: Pick<Session, "access_token"> | null
): Promise<void> {
  const recoverySessionId = getPasswordRecoverySessionId(session);
  if (!recoverySessionId) {
    return;
  }

  await AsyncStorage.setItem(
    HANDLED_PASSWORD_RECOVERY_SESSION_KEY,
    recoverySessionId
  );
}

export async function markPendingPasswordRecovery(): Promise<void> {
  const payload: PendingPasswordRecovery = { createdAt: Date.now() };
  await AsyncStorage.setItem(PASSWORD_RECOVERY_KEY, JSON.stringify(payload));
}

export async function clearPendingPasswordRecovery(): Promise<void> {
  await AsyncStorage.removeItem(PASSWORD_RECOVERY_KEY);
}

export async function consumePendingPasswordRecovery(): Promise<boolean> {
  const rawValue = await AsyncStorage.getItem(PASSWORD_RECOVERY_KEY);
  if (!rawValue) {
    return false;
  }

  await clearPendingPasswordRecovery();

  try {
    const payload = JSON.parse(rawValue) as Partial<PendingPasswordRecovery>;
    if (
      typeof payload.createdAt !== "number" ||
      Date.now() - payload.createdAt > PASSWORD_RECOVERY_TTL_MS
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}
