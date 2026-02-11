import { buildConversionPayload } from "../src/lib/tracking";

export default function LandingPage() {
  const ctaPayload = buildConversionPayload({ event: "cta_click", source: "hero" });

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ marginBottom: 8, fontSize: 44 }}>clearn.ai</h1>
      <p style={{ marginTop: 0, marginBottom: 24, fontSize: 18 }}>
        Foto zu Karte in Sekunden. Lernen mit FSRS, OCR und KI-gestützter Strukturierung.
      </p>

      <section style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
          <strong>1. Erfassen</strong>
          <p>Kamera oder Galerie, OCR direkt on-device.</p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
          <strong>2. Strukturieren</strong>
          <p>Automatische Flashcards mit Schema-Validierung und Fallback.</p>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
          <strong>3. Verankern</strong>
          <p>FSRS Reviews mit Offline-Queue und Sync.</p>
        </div>
      </section>

      <a
        href="/waitlist"
        data-event={JSON.stringify(ctaPayload)}
        style={{
          display: "inline-block",
          textDecoration: "none",
          background: "#111827",
          color: "white",
          borderRadius: 10,
          padding: "14px 20px",
          fontWeight: 600
        }}
      >
        Zur Beta-Warteliste
      </a>
    </main>
  );
}
