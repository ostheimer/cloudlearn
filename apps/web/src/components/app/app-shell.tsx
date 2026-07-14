"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { GraduationCap, Home, Layers, Sparkles, Zap, BarChart, User } from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  tabLabel?: string; // kürzeres Label für die untere Handy-Leiste
  Icon: typeof Layers;
  exact: boolean;
};

// App-artige Reihenfolge: „Home" ist die Landeseite. Am Desktop stehen alle
// außer Profil oben; am Handy erscheinen alle als untere Tab-Leiste.
const NAV: NavItem[] = [
  { href: "/dashboard/home", label: "Home", Icon: Home, exact: true },
  { href: "/dashboard", label: "Bibliothek", Icon: Layers, exact: true },
  { href: "/dashboard/import", label: "Scan", Icon: Sparkles, exact: false },
  { href: "/dashboard/lp", label: "Lernpunkte", Icon: Zap, exact: false },
  { href: "/dashboard/stats", label: "Statistik", Icon: BarChart, exact: false },
  { href: "/dashboard/profile", label: "Profil", Icon: User, exact: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Guard: bounce unauthenticated visitors to the login page.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const profile = NAV[NAV.length - 1]!;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar__inner">
          <Link href="/dashboard/home" className="brand">
            <span className="brand__mark" aria-hidden>
              <GraduationCap size={20} />
            </span>
            clearn.ai
          </Link>

          {/* Obere Navigation — nur am Desktop */}
          <nav className="app-nav" aria-label="Navigation">
            {NAV.slice(0, -1).map((item) => (
              <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
                <item.Icon size={17} /> {item.label}
              </Link>
            ))}
          </nav>

          {/* Konto — am Desktop das Personen-Symbol oben rechts */}
          <Link
            href={profile.href}
            className={`avatar${isActive(profile) ? " active" : ""}`}
            aria-label="Profil"
          >
            <User size={20} />
          </Link>
        </div>
      </header>

      <main className="app-main">
        <div className="container">{children}</div>
      </main>

      {/* Untere Tab-Leiste — nur am Handy (wie die App) */}
      <nav className="app-tabbar" aria-label="Navigation">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
            <item.Icon size={22} />
            <span>{item.tabLabel ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
