import { create } from "zustand";

interface SessionState {
  isAuthenticated: boolean;
  userId: string | null;
  signIn: (userId: string) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  isAuthenticated: false,
  userId: null,
  signIn: (userId: string) => set({ isAuthenticated: true, userId }),
  signOut: () => set({ isAuthenticated: false, userId: null })
}));
