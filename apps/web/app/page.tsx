import Link from "next/link";
import { buildConversionPayload } from "../src/lib/tracking";
import { SiteFrame } from "../src/components/site-frame";
import { siteConfig } from "../src/lib/site";

export default function LandingPage() {
  const ctaPayload = buildConversionPayload({ event: "cta_click", source: "hero" });

  return (
    <SiteFrame>
      <section
        style={{
          display: "grid",
          gap: 24,
          padding: "34px 28px",
          borderRadius: 28,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88) 56%, rgba(79,70,229,0.82))",
          color: "#f8fafc",
          boxShadow: "0 28px 70px rgba(15,23,42,0.14)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            width: "fit-content",
            padding: "8px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            color: "#cbd5f5",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Beta · iPhone, Android und Mobile Web
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1.02 }}>Lernmaterial rein. Flashcards raus.</h1>
          <p style={{ margin: 0, maxWidth: 720, fontSize: 19, lineHeight: 1.7, color: "#dbe4ff" }}>
            clearn verwandelt Fotos, PDFs, Texte und URLs in saubere Lernkarten. Danach lernst du mit Review-Sessions, Offline-Queue und synchronisiertem Fortschritt weiter.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a
            href={`${siteConfig.supportPath}#beta`}
            data-event={JSON.stringify(ctaPayload)}
            style={{
              display: "inline-flex",
              textDecoration: "none",
              background: "#f8fafc",
              color: "#0f172a",
              borderRadius: 14,
              padding: "14px 18px",
              fontWeight: 800,
            }}
          >
            Beta anfragen
          </a>
          <Link
            href={siteConfig.privacyPath}
            style={{
              display: "inline-flex",
              textDecoration: "none",
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
              borderRadius: 14,
              padding: "14px 18px",
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            Datenschutz ansehen
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 22,
        }}
      >
        {[
          {
            title: "1. Erfassen",
            body: "Kamera, Galerie, Text, URL oder PDF. Der schnellste Einstieg für vorhandenes Lernmaterial.",
          },
          {
            title: "2. Strukturieren",
            body: "KI und OCR erzeugen aus Rohmaterial saubere Flashcards mit klaren Vorder- und Rückseiten.",
          },
          {
            title: "3. Verankern",
            body: "Review-Sessions, Lernpunkte, Offline-Queue und Sync halten den Lernfluss stabil.",
          },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              padding: 20,
              borderRadius: 22,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: "0 22px 60px rgba(15,23,42,0.08)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 8, fontSize: 18, color: "#0f172a" }}>
              {item.title}
            </strong>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>{item.body}</p>
          </div>
        ))}
      </section>

      <section
        style={{
          marginTop: 22,
          padding: 22,
          borderRadius: 24,
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(15,23,42,0.08)",
          display: "grid",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24, color: "#111827" }}>Release-Basis steht</h2>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Öffentliche Support-, Datenschutz- und Impressumsseiten sind erreichbar. Das macht clearn für App-Store-Prüfung, Beta-Kommunikation und Support sauberer als die bisherige Dummy-CTA.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href={siteConfig.supportPath} style={{ color: "#4338ca", textDecoration: "none", fontWeight: 700 }}>
            Support
          </Link>
          <Link href={siteConfig.privacyPath} style={{ color: "#4338ca", textDecoration: "none", fontWeight: 700 }}>
            Datenschutz
          </Link>
          <Link href={siteConfig.impressumPath} style={{ color: "#4338ca", textDecoration: "none", fontWeight: 700 }}>
            Impressum
          </Link>
        </div>
      </section>
    </SiteFrame>
  );
}
