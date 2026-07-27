import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/app/auth-context";

export const metadata: Metadata = { title: "Einführung" };

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
