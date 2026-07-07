import type { ReactNode } from "react";
import { AuthProvider } from "@/components/app/auth-context";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="auth-wrap">{children}</div>
    </AuthProvider>
  );
}
