"use client";

import { useEffect } from "react";
import Link from "next/link";

// Globale Fehlerseite (Teil von #213): fängt Laufzeitfehler unterhalb des
// Root-Layouts ab und zeigt statt der englischen Next.js-Standardseite eine
// ruhige deutsche Seite im clearn-Look. Bewusst ohne Header/Footer, damit die
// Fehlergrenze selbst so wenig wie möglich schiefgehen kann.

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "clamp(20px, 5vw, 40px)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 640,
          padding: "clamp(28px, 6vw, 44px) clamp(20px, 5vw, 36px)",
          borderRadius: 28,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-md)",
          display: "grid",
          gap: 14,
          justifyItems: "start",
        }}
      >
        <span className="eyebrow">Fehler</span>
        <h1 className="h1">Etwas ist schiefgelaufen</h1>
        <p className="lead" style={{ maxWidth: 520 }}>
          Das hat gerade nicht geklappt — versuch es einfach noch einmal.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Erneut versuchen
          </button>
          <Link href="/" className="btn btn-ghost">
            Zur Startseite
          </Link>
        </div>
      </section>
    </main>
  );
}
