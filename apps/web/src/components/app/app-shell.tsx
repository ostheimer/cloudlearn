"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { DisplayNamePrompt } from "./display-name-prompt";
import { listDecks } from "@/lib/api";
import {
  decideOnboarding,
  isOnboardingCompleted,
  markOnboardingCompleted,
} from "@/lib/onboarding";
import { GraduationCap, Home, Library, ScanLine, Zap, BarChart, User } from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  tabLabel?: string; // kürzeres Label für die untere Handy-Leiste
  hideInTabbar?: boolean; // am Handy nicht in der unteren Leiste — nur über die LP-Pille oben (wie die App)
  hideInTopbar?: boolean; // am Desktop nicht in der Kopfzeile — dito
  Icon: typeof Home;
  exact: boolean;
};

// App-artige Reihenfolge: „Home" ist die Landeseite. Am Desktop stehen alle
// außer Profil oben; am Handy erscheinen sie als untere Tab-Leiste — außer
// Lernpunkte, die dort (wie in der App) nur über die Pille oben erreichbar sind.
// Reihenfolge und Symbole wie in der App-Tab-Leiste
// (apps/mobile/app/(tabs)/_layout.tsx): Home, Scan, Bibliothek, Statistik,
// Profil — Scan steht also VOR Bibliothek, und Bibliothek trägt die Bücherreihe
// statt der Ebenen-Symbole.
//
// Lernpunkte ist in BEIDEN Navigationen ausgeblendet: Die App hat dafür keinen
// Tab, sondern die LP-Pille auf der Startseite (dort und auf der Scan-Seite
// führt je ein Link zu /dashboard/lp). Profil steht dadurch am Desktop als
// fünfter Punkt in der Zeile — genau wie unten am Handy; das frühere runde
// Personen-Symbol rechts entfällt (Laras Wahl 27.07.).
const NAV: NavItem[] = [
  { href: "/dashboard/home", label: "Home", Icon: Home, exact: true },
  { href: "/dashboard/import", label: "Scan", Icon: ScanLine, exact: false },
  { href: "/dashboard", label: "Bibliothek", Icon: Library, exact: true },
  {
    href: "/dashboard/lp",
    label: "Lernpunkte",
    Icon: Zap,
    exact: false,
    hideInTabbar: true,
    hideInTopbar: true,
  },
  { href: "/dashboard/stats", label: "Statistik", Icon: BarChart, exact: false },
  { href: "/dashboard/profile", label: "Profil", Icon: User, exact: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { status, userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Guard: bounce unauthenticated visitors to the login page.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Erst-Start-Weiche: Fehlt der Browser-Haken, entscheidet die Deck-Zahl —
  // nur Konten ohne Decks sehen die Einführung, alle anderen bekommen den
  // Haken still gesetzt (siehe lib/onboarding.ts). Ist der Haken einmal da,
  // kostet das keinen API-Aufruf mehr.
  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    if (isOnboardingCompleted()) {
      setOnboardingChecked(true);
      return;
    }
    let cancelled = false;
    listDecks(userId)
      .then(({ decks }) => {
        if (cancelled) return;
        if (decideOnboarding(decks.length) === "show") {
          router.replace("/onboarding");
          return;
        }
        markOnboardingCompleted();
        setOnboardingChecked(true);
      })
      .catch(() => {
        // Im Zweifel das Dashboard nicht blockieren.
        if (!cancelled) setOnboardingChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, userId, router]);

  if (status !== "authenticated" || !onboardingChecked) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="app-shell">
      <DisplayNamePrompt />
      <header className="app-topbar">
        <div className="container app-topbar__inner">
          <Link href="/dashboard/home" className="brand">
            <span className="brand__mark" aria-hidden>
              <GraduationCap size={20} />
            </span>
            clearn.ai
          </Link>

          {/* Obere Navigation — nur am Desktop. Enthält jetzt auch Profil, das
              früher als rundes Personen-Symbol rechts stand. */}
          <nav className="app-nav" aria-label="Navigation">
            {NAV.filter((item) => !item.hideInTopbar).map((item) => (
              <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
                <item.Icon size={17} /> {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="container">{children}</div>
      </main>

      {/* Untere Tab-Leiste — nur am Handy (wie die App); Lernpunkte fehlen hier
          bewusst und sind über die Pille auf der Startseite erreichbar. */}
      <nav className="app-tabbar" aria-label="Navigation">
        {NAV.filter((item) => !item.hideInTabbar).map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
            <item.Icon size={22} />
            <span>{item.tabLabel ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
