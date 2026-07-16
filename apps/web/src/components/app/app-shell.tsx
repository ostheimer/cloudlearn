"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { GraduationCap, Layers, Sparkles, Zap, BarChart, User } from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  tabLabel?: string; // kürzeres Label für die untere Handy-Leiste
  Icon: typeof Layers;
  exact: boolean;
};

// App-Reihenfolge, an die Web-Bereiche angepasst (kein „Home"/„Lernen" — die
// gibt es im Web noch nicht). Ab Tablet-Breite stehen alle Einträge in der
// linken Seitenleiste (Profil unten abgesetzt, wie in App-Web-Versionen
// üblich); am Handy erscheinen alle als untere Tab-Leiste.
const NAV: NavItem[] = [
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
      {/* Seitenleiste — ab Tablet-Breite; am Handy übernimmt die Tab-Leiste */}
      <aside className="app-sidebar">
        <Link href="/dashboard" className="brand app-sidebar__brand">
          <span className="brand__mark" aria-hidden>
            <GraduationCap size={20} />
          </span>
          <span className="app-sidebar__label">clearn.ai</span>
        </Link>

        <nav className="app-sidebar__nav" aria-label="Navigation">
          {NAV.slice(0, -1).map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
              <item.Icon size={19} />
              <span className="app-sidebar__label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="app-sidebar__foot">
          <Link href={profile.href} className={isActive(profile) ? "active" : ""}>
            <profile.Icon size={19} />
            <span className="app-sidebar__label">{profile.label}</span>
          </Link>
        </div>
      </aside>

      <div className="app-shell__body">
        {/* Obere Logo-Leiste — nur am Handy */}
        <header className="app-topbar">
          <div className="container app-topbar__inner">
            <Link href="/dashboard" className="brand">
              <span className="brand__mark" aria-hidden>
                <GraduationCap size={20} />
              </span>
              clearn.ai
            </Link>
          </div>
        </header>

        <main className="app-main">
          <div className="container container--app">{children}</div>
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
    </div>
  );
}
