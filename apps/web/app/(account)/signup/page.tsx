import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function SignupPage() {
  // Suspense ist Pflicht, seit das Formular `useSearchParams()` liest (#716,
  // für den ?next=-Rücksprung nach dem Übernehmen eines geteilten Decks).
  // Ohne diese Grenze bricht Next beim Vorab-Erzeugen dieser Seite ab — und
  // damit der GESAMTE Web-Build, also auch jede Auslieferung.
  return (
    <Suspense fallback={<div className="spinner" />}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
