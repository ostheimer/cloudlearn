import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FlashcardDemo } from "@/components/marketing/flashcard-demo";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { siteConfig } from "@/lib/site";
import { landingCtas } from "@/lib/landing";

const steps = [
  {
    title: "Erfassen",
    body: "Foto, Galerie, Text, URL oder PDF rein. Der schnellste Weg von vorhandenem Lernmaterial zu digitalen Karten.",
  },
  {
    title: "Strukturieren",
    body: "KI und OCR verwandeln Rohmaterial in saubere Flashcards mit klarer Vorder- und Rückseite — du prüfst nur noch.",
  },
  {
    title: "Verankern",
    body: "Spaced Repetition bringt dir täglich genau die Karten, die dran sind. Streaks und Tagesziele halten dich dabei.",
  },
];

const features = [
  {
    icon: "📸",
    tint: "g-indigo",
    title: "Foto → Flashcards",
    body: "Fotografiere Skript, Buch oder Tafel. OCR liest den Text, die KI macht daraus lernbare Karten.",
  },
  {
    icon: "✨",
    tint: "g-violet",
    title: "KI-Kartengenerator",
    body: "Aus Text, URL oder PDF entstehen präzise Frage-Antwort-Paare — statt stundenlangem Abtippen.",
  },
  {
    icon: "🔁",
    tint: "g-green",
    title: "Spaced Repetition",
    body: "Ein modernes FSRS-Verfahren plant jede Wiederholung optimal — du lernst weniger und behältst mehr.",
  },
  {
    icon: "🎯",
    tint: "g-pink",
    title: "Mehrere Lernmodi",
    body: "Karteikarten, Multiple Choice, Zuordnen und Lückentext — dasselbe Deck, verschiedene Blickwinkel.",
  },
  {
    icon: "🔥",
    tint: "g-amber",
    title: "Streaks & Lernpunkte",
    body: "Tagesziele, Serien und Lernpunkte machen aus Wiederholen eine Gewohnheit, die bleibt.",
  },
  {
    icon: "☁️",
    tint: "g-blue",
    title: "Sync & Teilen",
    body: "Decks sind an dein Konto gebunden, synchron auf allen Geräten — und mit einem Link teilbar.",
  },
];

const modes = [
  { icon: "🃏", tint: "g-indigo", title: "Karteikarten", desc: "Klassisch umdrehen & bewerten" },
  { icon: "🔤", tint: "g-violet", title: "Multiple Choice", desc: "Antwort aus Optionen wählen" },
  { icon: "🔗", tint: "g-pink", title: "Zuordnen", desc: "Begriffe & Definitionen paaren" },
  { icon: "✍️", tint: "g-green", title: "Lückentext", desc: "Fehlendes aktiv ergänzen" },
];

const faqs = [
  {
    q: "Was kostet clearn?",
    a: "Du kannst kostenlos starten und Decks anlegen. Für intensives KI-Erstellen gibt es Lernpunkte und optionale Pro-Funktionen — zum Ausprobieren brauchst du nichts zu zahlen.",
  },
  {
    q: "Woraus kann ich Karten erstellen?",
    a: "Aus Fotos, Galerie-Bildern, reinem Text, Webseiten-URLs und PDF-Dokumenten. OCR und KI übernehmen das Umwandeln in Flashcards.",
  },
  {
    q: "Wie funktioniert das Wiederholen?",
    a: "clearn nutzt ein FSRS-basiertes Spaced-Repetition-System. Es lernt aus deinen Bewertungen (Nochmal/Schwer/Gut/Leicht) und plant den idealen nächsten Zeitpunkt für jede Karte.",
  },
  {
    q: "Auf welchen Geräten läuft clearn?",
    a: "Die App startet auf dem iPhone (aktuell über TestFlight). Deine Decks sind an dein Konto gebunden und lassen sich mit anderen Geräten synchronisieren.",
  },
  {
    q: "Kann ich meine Decks teilen?",
    a: "Ja. Jedes Deck kann per Link geteilt werden — andere sehen eine Vorschau und können es als eigene, unabhängige Kopie übernehmen.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "clearn",
  applicationCategory: "EducationalApplication",
  operatingSystem: "iOS",
  description:
    "clearn verwandelt Fotos, PDFs, Texte und URLs in strukturierte Flashcards und lässt dich mit Spaced Repetition effizient lernen.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__copy">
              <span className="pill pill-dark">
                <span className="dot" /> TestFlight · iPhone zuerst
              </span>
              <h1 className="h-display">
                Lernmaterial rein.
                <br />
                <span className="gradient-text">Flashcards raus.</span>
              </h1>
              <p className="lead">
                clearn verwandelt Fotos, PDFs, Texte und URLs in klare Lernkarten. Danach bringt dir
                Spaced Repetition genau die Karten, die heute fällig sind — und dein Fortschritt
                bleibt sichtbar.
              </p>
              <div className="hero__cta">
                <a
                  href={landingCtas.primary.href}
                  className="btn btn-primary btn-lg"
                  data-event={JSON.stringify(landingCtas.primary.event)}
                >
                  {landingCtas.primary.label}
                </a>
                <a href="#so-gehts" className="btn btn-on-dark btn-lg">
                  So funktioniert's
                </a>
              </div>
              <div className="hero__meta">
                <span>✅ Kostenlos starten</span>
                <span>🔒 Datenschutz-first</span>
                <span>🇦🇹 Made in Austria</span>
              </div>
            </div>

            {/* Phone mockup with floating chips */}
            <div className="hero__visual" aria-hidden>
              <div className="float-card float-card--a">
                <span className="ic g-indigo">📸</span> Foto gescannt
              </div>
              <div className="float-card float-card--b">
                <span className="ic g-green">✅</span> 24 Karten erstellt
              </div>
              <div className="float-card float-card--c">
                <span className="ic g-amber">🔥</span> 7-Tage-Streak
              </div>

              <div className="phone">
                <div className="phone__notch" />
                <div className="phone__screen">
                  <div className="mini-card">
                    <small>Deck · Biologie</small>
                    <strong>Zellorganellen</strong>
                    <span>24 Karten · 8 heute fällig</span>
                  </div>
                  <div className="mini-card">
                    <small>Heute</small>
                    <strong>Tagesziel</strong>
                    <div className="mini-bar">
                      <i style={{ width: "72%" }} />
                    </div>
                    <span>18 / 25 Wiederholungen</span>
                  </div>
                  <div className="mini-card">
                    <small>Frage</small>
                    <strong>Was ist die Funktion der Mitochondrien?</strong>
                    <span>Tippen zum Umdrehen ↻</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Trust strip ---------------- */}
        <div className="trust">
          <div className="container trust__inner">
            <span>📸 <b>Foto → Karten</b></span>
            <span>📄 <b>PDF-Import</b></span>
            <span>🔗 <b>URL-Import</b></span>
            <span>🧠 <b>FSRS-Spaced-Repetition</b></span>
            <span>☁️ <b>Sync</b></span>
          </div>
        </div>

        {/* ---------------- How it works ---------------- */}
        <section id="so-gehts" className="section">
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow-chip">So geht's</span>
              <h2 className="h2">In drei Schritten vom Material zum Wissen</h2>
              <p className="lead">
                Kein Abtippen, kein Karten-Basteln. clearn übernimmt die Fleißarbeit — du
                konzentrierst dich aufs Lernen.
              </p>
            </div>
            <div className="steps">
              {steps.map((step, i) => (
                <div key={step.title} className="step reveal">
                  <div className="step__num">{i + 1}</div>
                  <h3 className="h3">{step.title}</h3>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section id="features" className="section" style={{ background: "var(--bg-soft)" }}>
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow-chip">Features</span>
              <h2 className="h2">Alles, was gutes Lernen braucht</h2>
              <p className="lead">
                Von der Erfassung bis zur letzten Wiederholung — clearn deckt den ganzen Lernweg ab.
              </p>
            </div>
            <div className="grid grid-3">
              {features.map((f) => (
                <article key={f.title} className="card reveal">
                  <div className={`card__icon ${f.tint}`} aria-hidden>
                    {f.icon}
                  </div>
                  <h3 className="h3">{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Capture split ---------------- */}
        <section className="section">
          <div className="container split">
            <div className="split__media reveal">
              <div className="stack">
                <div className="mini-card">
                  <small>Import · PDF</small>
                  <strong>Skript_Kapitel_3.pdf</strong>
                  <div className="mini-bar">
                    <i style={{ width: "100%" }} />
                  </div>
                  <span>12 Seiten gelesen · 31 Karten vorgeschlagen</span>
                </div>
                <div className="mini-card">
                  <small>KI-Vorschlag</small>
                  <strong>„Was beschreibt die Osmose?"</strong>
                  <span>Diffusion von Wasser durch eine semipermeable Membran.</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="pill">✓ Übernehmen</span>
                  <span className="pill" style={{ background: "var(--bg-softer)", color: "var(--ink-3)", borderColor: "var(--line)" }}>
                    ✎ Bearbeiten
                  </span>
                </div>
              </div>
            </div>
            <div className="reveal">
              <span className="eyebrow">Erfassen & Erstellen</span>
              <h2 className="h2" style={{ marginBlock: "14px 16px" }}>
                Dein Material wird zu Karten — in Sekunden
              </h2>
              <p className="lead">
                Fotografiere eine Buchseite, wirf ein PDF oder einen Link hinein: OCR erkennt den
                Text, die KI schlägt fertige Flashcards vor. Du prüfst, passt an und lernst los.
              </p>
              <ul className="reset check-list">
                <li>
                  <span className="tick">✓</span> Kamera, Galerie, Text, URL & PDF als Quelle
                </li>
                <li>
                  <span className="tick">✓</span> Mathematische Formeln werden sauber erkannt
                </li>
                <li>
                  <span className="tick">✓</span> Jede Karte bleibt vollständig bearbeitbar
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- Learning modes ---------------- */}
        <section id="lernmodi" className="section" style={{ background: "var(--bg-soft)" }}>
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow-chip">Lernmodi</span>
              <h2 className="h2">Ein Deck, viele Wege es zu können</h2>
              <p className="lead">
                Wer aus mehreren Perspektiven übt, erinnert sich besser. clearn bietet den Stoff in
                vier Modi an.
              </p>
            </div>

            <div className="split" style={{ marginBottom: 40 }}>
              <div className="reveal">
                <div className="modes">
                  {modes.map((m) => (
                    <div key={m.title} className="mode">
                      <span className={`ic ${m.tint}`} aria-hidden>
                        {m.icon}
                      </span>
                      <div>
                        <b>{m.title}</b>
                        <span>{m.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="split__media reveal">
                <span className="flip__label" style={{ color: "var(--brand-600)" }}>
                  Live-Demo · Karteikarte
                </span>
                <div style={{ marginTop: 14 }}>
                  <FlashcardDemo />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Stats band ---------------- */}
        <section className="section-sm">
          <div className="container">
            <div className="stat-band reveal">
              <div className="stat">
                <b>4</b>
                <span>Lernmodi</span>
              </div>
              <div className="stat">
                <b>FSRS</b>
                <span>Modernes Spaced-Repetition-Verfahren</span>
              </div>
              <div className="stat">
                <b>5×</b>
                <span>Quellen: Foto, Galerie, Text, URL, PDF</span>
              </div>
              <div className="stat">
                <b>☁️</b>
                <span>Sync auf allen Geräten</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Retention / gamification split ---------------- */}
        <section className="section">
          <div className="container split split--reverse">
            <div className="split__media reveal">
              <div className="stack">
                <div className="mini-card">
                  <small>Fortschritt</small>
                  <strong>🔥 7-Tage-Streak</strong>
                  <div className="mini-bar">
                    <i style={{ width: "86%" }} />
                  </div>
                  <span>Tagesziel fast geschafft — noch 3 Karten</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="mini-card center">
                    <strong style={{ fontSize: "1.4rem" }}>128</strong>
                    <span>Karten gemeistert</span>
                  </div>
                  <div className="mini-card center">
                    <strong style={{ fontSize: "1.4rem" }}>96%</strong>
                    <span>Trefferquote</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="reveal">
              <span className="eyebrow">Dranbleiben</span>
              <h2 className="h2" style={{ marginBlock: "14px 16px" }}>
                Gewohnheiten, die Wissen sichern
              </h2>
              <p className="lead">
                Lernen scheitert selten am Anfang, sondern am Dranbleiben. Streaks, Tagesziele und
                Lernpunkte machen jede Wiederholung sichtbar belohnend — und deine Statistik zeigt,
                wie weit du schon bist.
              </p>
              <ul className="reset check-list">
                <li>
                  <span className="tick">✓</span> Tägliche Serie & individuelle Tagesziele
                </li>
                <li>
                  <span className="tick">✓</span> Lernpunkte als Belohnung fürs Wiederholen
                </li>
                <li>
                  <span className="tick">✓</span> Statistiken zu Streak, Trefferquote & Fortschritt
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="section" style={{ background: "var(--bg-soft)" }}>
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow-chip">FAQ</span>
              <h2 className="h2">Häufige Fragen</h2>
            </div>
            <div className="faq reveal">
              {faqs.map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                    <span className="chev" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section className="section-sm">
          <div className="container">
            <div className="cta-band reveal">
              <span className="pill pill-dark">Bereit für TestFlight</span>
              <h2 className="h2">Fang heute an, klüger zu lernen</h2>
              <p className="lead" style={{ color: "rgba(255,255,255,0.9)" }}>
                Hol dir den TestFlight-Zugang und verwandle dein erstes Lernmaterial in Flashcards —
                in wenigen Minuten.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                <a href={landingCtas.primary.href} className="btn btn-ghost btn-lg">
                  {landingCtas.primary.label}
                </a>
                <Link href={siteConfig.supportPath} className="btn btn-on-dark btn-lg">
                  Fragen? Support
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <ScrollReveal />
    </>
  );
}
