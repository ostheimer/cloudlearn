import type { Metadata } from "next";
import type { ReactNode } from "react";

// Die Seite selbst ist eine Client-Komponente ("use client") und darf daher
// keinen Titel exportieren. Dieses schlanke Layout trägt nur den Tab-Titel und
// reicht den Inhalt unverändert durch (#533 Punkt 2).
export const metadata: Metadata = { title: "Passwort zurücksetzen" };

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
