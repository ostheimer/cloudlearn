import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

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
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  // Email + Password sign in
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
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

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ isAuthenticated: false, isLoading: false, userId: null, email: null, session: null });
  },
}));
