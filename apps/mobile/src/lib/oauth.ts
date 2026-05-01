import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export type OAuthProvider = "google" | "apple";

export interface OAuthStartResult {
  error: string | null;
  cancelled?: boolean;
}

WebBrowser.maybeCompleteAuthSession();

function getOAuthQueryParams(provider: OAuthProvider): Record<string, string> | undefined {
  if (provider !== "google") {
    return undefined;
  }

  return {
    access_type: "offline",
    prompt: "consent",
  };
}

export function getOAuthRedirectUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/auth-callback`;
  }

  return Linking.createURL("auth-callback");
}

export function getPasswordRecoveryRedirectUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }

  return Linking.createURL("reset-password");
}

export async function completeOAuthSignIn(
  callbackUrl: string
): Promise<OAuthStartResult> {
  const { queryParams } = Linking.parse(callbackUrl);
  const rawError =
    queryParams?.error_description ?? queryParams?.error ?? null;
  const errorMessage = Array.isArray(rawError) ? rawError[0] : rawError;

  if (typeof errorMessage === "string" && errorMessage.length > 0) {
    return { error: errorMessage };
  }

  const rawCode = queryParams?.code ?? null;
  const authCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  if (typeof authCode !== "string" || authCode.length === 0) {
    return { error: "Anmeldecode fehlt." };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(authCode);
  return { error: error?.message ?? null };
}

export async function startOAuthSignIn(
  provider: OAuthProvider
): Promise<OAuthStartResult> {
  const redirectTo = getOAuthRedirectUrl();
  const queryParams = getOAuthQueryParams(provider);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== "web",
      ...(queryParams ? { queryParams } : {}),
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (Platform.OS === "web") {
    return { error: null };
  }

  if (!data.url) {
    return { error: "OAuth-URL fehlt." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel" || result.type === "dismiss") {
    return { error: null, cancelled: true };
  }

  if (result.type !== "success" || !result.url) {
    return { error: "OAuth-Login konnte nicht abgeschlossen werden." };
  }

  return completeOAuthSignIn(result.url);
}
