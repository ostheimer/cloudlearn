import type { Metadata } from "next";
import type { ReactNode } from "react";

// Wie forgot-password: Client-Seite ohne eigenen Titel. Das Layout ergänzt nur
// den Tab-Titel für den Weg aus der Zurücksetzen-Mail (#533 Punkt 2).
export const metadata: Metadata = { title: "Neues Passwort" };

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
