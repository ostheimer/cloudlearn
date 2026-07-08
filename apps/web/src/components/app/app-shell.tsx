"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { GraduationCap, Zap, BarChart, Globe, LogOut } from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Bibliothek", exact: true },
  { href: "/dashboard/stats", label: "Statistik", exact: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { status, email, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Guard: bounce unauthenticated visitors to the login page.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (status !== "authenticated") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const initial = (email?.[0] ?? "?").toUpperCase();

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="container app-topbar__inner">
          <Link href="/dashboard" className="brand">
            <span className="brand__mark" aria-hidden>
              <GraduationCap size={20} />
            </span>
            clearn.ai
          </Link>

          <nav className="app-nav" aria-label="App-Navigation">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "active" : ""}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pop" ref={menuRef}>
            <button
              type="button"
              className="avatar"
              aria-label="Kontomenü"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {initial}
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: "0.82rem",
                    color: "var(--ink-3)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {email}
                </div>
                <Link href="/dashboard/lp" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <Zap size={16} /> Lernpunkte
                </Link>
                <Link href="/dashboard/stats" role="menuitem" onClick={() => setMenuOpen(false)}>
                  <BarChart size={16} /> Statistik
                </Link>
                <a href="/" role="menuitem">
                  <Globe size={16} /> Zur Website
                </a>
                <button type="button" className="danger" role="menuitem" onClick={handleSignOut}>
                  <LogOut size={16} /> Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
