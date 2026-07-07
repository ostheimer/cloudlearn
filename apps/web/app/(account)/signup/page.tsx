import type { Metadata } from "next";
import { AuthForm } from "@/components/app/auth-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
