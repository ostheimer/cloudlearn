"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase-browser";
import { toGermanAuthError } from "@/lib/auth-errors";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type OAuthProvider = "google" | "apple";

interface SignUpResult {
  error: string | null;
  requiresEmailConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /**
   * E-Mail-Adresse ändern (#614). Supabase verschickt eine Bestätigung an die
   * NEUE Adresse; erst der Klick darin stellt das Konto um. Bis dahin gilt
   * die alte — die Anmeldung ändert sich also nicht sofort.
   */
  changeEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setStatus(data.session ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!active) return;
        setStatus("unauthenticated");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const supabase = getSupabase();
    return {
      status,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return { error: error ? toGermanAuthError(error.message) : null };
      },

      signUp: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (error) return { error: toGermanAuthError(error.message) };
        // Supabase returns a user with no identities when the e-mail already exists.
        if (data.user && !data.session && data.user.identities?.length === 0) {
          return { error: toGermanAuthError("user already registered") };
        }
        if (data.session) return { error: null, requiresEmailConfirmation: false };
        return { error: null, requiresEmailConfirmation: true };
      },

      signInWithOAuth: async (provider) => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: callbackUrl(),
            ...(provider === "google"
              ? { queryParams: { access_type: "offline", prompt: "consent" } }
              : {}),
          },
        });
        // On success the browser is redirected away, so this only returns on error.
        return { error: error ? toGermanAuthError(error.message) : null };
      },

      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/reset-password` }
        );
        return { error: error ? toGermanAuthError(error.message) : null };
      },

      changeEmail: async (email) => {
        const { error } = await supabase.auth.updateUser(
          { email: email.trim().toLowerCase() },
          { emailRedirectTo: callbackUrl() }
        );
        return { error: error ? toGermanAuthError(error.message) : null };
      },

      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [status, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
