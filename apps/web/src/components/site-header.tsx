"use client";

import Link from "next/link";
import { useState } from "react";
import { siteConfig, marketingNavLinks } from "@/lib/site";
import { GraduationCap, Menu, X } from "@/components/icons";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

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
          <Link href="/login" className="nav-link">
            Anmelden
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Kostenlos starten
          </Link>
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
        </nav>
      )}
    </header>
  );
}
