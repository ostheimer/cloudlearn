"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase-browser";
import { siteConfig, marketingNavLinks } from "@/lib/site";
import { GraduationCap, Menu, X } from "@/components/icons";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  // Die öffentliche Kopfzeile liegt auf Seiten ohne AuthProvider (Landing,
  // Impressum, Datenschutz, Support, 404) — useAuth würde dort werfen. Darum
  // die Sitzung direkt bei Supabase erfragen. Standard bleibt „ausgeloggt", weil
  // die meisten Besucher der Marketing-Seiten das sind; eingeloggte Nutzer
  // schalten nach der (lokalen, schnellen) Prüfung auf „Zum Dashboard" um, statt
  // fälschlich die Anmelde-Knöpfe zu sehen (#533 Punkt 3).
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setAuthed(!!data.session);
      })
      .catch(() => {});
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand__mark" aria-hidden>
            <GraduationCap size={20} />
          </span>
          {siteConfig.brandName}
        </Link>

        <nav className="nav-desktop" aria-label="Hauptnavigation">
          {marketingNavLinks.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {authed ? (
            <Link href="/dashboard" className="btn btn-primary">
              Zum Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="nav-link">
                Anmelden
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Kostenlos starten
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="nav-mobile" aria-label="Mobile Navigation">
          {marketingNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href={siteConfig.supportPath} className="nav-link" onClick={() => setOpen(false)}>
            Support
          </Link>
          {authed ? (
            <Link
              href="/dashboard"
              className="btn btn-primary btn-block"
              style={{ marginTop: 8 }}
              onClick={() => setOpen(false)}
            >
              Zum Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="nav-link" onClick={() => setOpen(false)}>
                Anmelden
              </Link>
              <Link
                href="/signup"
                className="btn btn-primary btn-block"
                style={{ marginTop: 8 }}
                onClick={() => setOpen(false)}
              >
                Kostenlos starten
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
