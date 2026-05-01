import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { OAuthProvider } from "../lib/oauth";
import { toGermanAuthError } from "../lib/authErrorMessages";

interface SignUpResult {
  error: string | null;
  requiresEmailConfirmation?: boolean;
}

interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  email: string | null;
  session: Session | null;
  dueCount: number;
  setDueCount: (count: number) => void;
  // Initialize auth state from Supabase
  initialize: () => Promise<void>;
  // Set session from auth state change
  setSession: (session: Session | null) => void;
  // Email + Password sign up
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  // Email + Password sign in
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  // OAuth sign in
  signInWithOAuth: (
    provider: OAuthProvider
  ) => Promise<{ error: string | null; cancelled?: boolean }>;
  // Password reset
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  // Sign out
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  email: null,
  session: null,
  dueCount: 0,
  setDueCount: (count: number) => set({ dueCount: count }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({
          isAuthenticated: true,
          isLoading: false,
          userId: session.user.id,
          email: session.user.email ?? null,
          session,
        });
      } else {
        set({ isAuthenticated: false, isLoading: false, userId: null, email: null, session: null });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false, userId: null, email: null, session: null });
    }
  },

  setSession: (session: Session | null) => {
    if (session?.user) {
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: session.user.id,
        email: session.user.email ?? null,
        session,
      });
    } else {
      set({ isAuthenticated: false, isLoading: false, userId: null, email: null, session: null });
    }
  },

  signUp: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { getOAuthRedirectUrl } = await import("../lib/oauth");
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getOAuthRedirectUrl(),
      },
    });
    if (error) return { error: toGermanAuthError(error.message) };
    if (data.user && !data.session && data.user.identities?.length === 0) {
      return { error: toGermanAuthError("user already registered") };
    }
    if (data.session?.user) {
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: data.session.user.id,
        email: data.session.user.email ?? normalizedEmail,
        session: data.session,
      });
      return { error: null, requiresEmailConfirmation: false };
    }
    return { error: null, requiresEmailConfirmation: true };
  },

  signIn: async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return { error: toGermanAuthError(error.message) };
    if (data.session?.user) {
      set({
        isAuthenticated: true,
        isLoading: false,
        userId: data.session.user.id,
        email: data.session.user.email ?? null,
        session: data.session,
      });
    }
    return { error: null };
  },

  signInWithOAuth: async (provider: OAuthProvider) => {
    const { startOAuthSignIn } = await import("../lib/oauth");
    return startOAuthSignIn(provider);
  },

  resetPassword: async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { getPasswordRecoveryRedirectUrl } = await import("../lib/oauth");
    const {
      clearPendingPasswordRecovery,
      markPendingPasswordRecovery,
    } = await import("../lib/passwordRecovery");
    await markPendingPasswordRecovery();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getPasswordRecoveryRedirectUrl(),
    });
    if (error) {
      await clearPendingPasswordRecovery();
      return { error: toGermanAuthError(error.message) };
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ isAuthenticated: false, isLoading: false, userId: null, email: null, session: null });
  },
}));
