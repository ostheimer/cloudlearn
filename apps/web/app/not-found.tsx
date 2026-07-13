import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";

// Globale 404-Seite (Teil von #213): fängt alle unbekannten Adressen ab,
// damit statt der englischen Next.js-Standardseite eine deutsche Seite im
// clearn-Look erscheint. Aufbau wie app/deck/[token]/not-found.tsx.

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
};

export default function RootNotFound() {
  return (
    <SiteFrame>
      <section
        style={{
          padding: "clamp(28px, 6vw, 48px) clamp(20px, 5vw, 40px)",
          borderRadius: 28,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-md)",
          display: "grid",
          gap: 14,
          justifyItems: "start",
        }}
      >
        <p
          className="gradient-text"
          style={{
            fontSize: "clamp(3.5rem, 16vw, 6rem)",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          404
        </p>
        <h1 className="h1">Diese Seite gibt es nicht</h1>
        <p className="lead" style={{ maxWidth: 640 }}>
          Der Link ist vielleicht veraltet oder die Adresse vertippt.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          <Link href="/" className="btn btn-primary">
            Zur Startseite
          </Link>
          <Link href="/dashboard" className="btn btn-ghost">
            Zum Dashboard
          </Link>
        </div>
      </section>
    </SiteFrame>
  );
}
