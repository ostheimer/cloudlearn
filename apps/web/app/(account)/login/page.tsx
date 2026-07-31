import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  // Siehe signup/page.tsx: dasselbe Formular, dieselbe Pflicht-Grenze. Der
  // Build brach zuerst auf /signup ab und wäre danach hier weitergegangen.
  return (
    <Suspense fallback={<div className="spinner" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
