import type { ReactNode } from "react";
import { AuthProvider } from "@/components/app/auth-context";
import { AppShell } from "@/components/app/app-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
