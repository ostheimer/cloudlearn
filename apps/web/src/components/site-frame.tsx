import Link from "next/link";
import type { ReactNode } from "react";
import { siteConfig, siteNavLinks } from "../lib/site";

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(99,102,241,0.12), transparent 32%), #f5f6fb",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 56px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 28,
            padding: "14px 16px",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 18,
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Link
            href="/"
            style={{ color: "#111827", textDecoration: "none", fontSize: 22, fontWeight: 800 }}
          >
            {siteConfig.brandName}
          </Link>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {siteNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: "#334155",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(15,23,42,0.06)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        {children}

        <footer
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            color: "#475569",
            fontSize: 14,
          }}
        >
          <div>
            {siteConfig.brandName} · Lern-App für strukturierte Flashcards, OCR und Review-Sessions.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {siteNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: "#334155", textDecoration: "none", fontWeight: 600 }}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={siteConfig.supportMailto}
              style={{ color: "#334155", textDecoration: "none", fontWeight: 600 }}
            >
              {siteConfig.supportEmail}
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
