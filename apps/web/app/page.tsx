import type { ComponentType } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FlashcardDemo } from "@/components/marketing/flashcard-demo";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { landingCtas } from "@/lib/landing";
import {
  Camera,
  ImageIcon,
  TextType,
  Link as LinkIcon,
  FileText,
  Repeat,
  Target,
  Folder,
  Share,
  Zap,
  Check,
  CheckCircle,
  ShieldCheck,
  MapPin,
  Plus,
  Layers,
  ListChecks,
  Match,
  Pencil,
  Flame,
  Globe,
  Smartphone,
  type IconProps,
} from "@/components/icons";

type IconType = ComponentType<IconProps>;

const sources: { Icon: IconType; label: string }[] = [
  { Icon: Camera, label: "Foto" },
  { Icon: ImageIcon, label: "Galerie" },
  { Icon: TextType, label: "Text" },
  { Icon: LinkIcon, label: "URL" },
  { Icon: FileText, label: "PDF" },
];

const steps = [
  {
    title: "Erfassen",
    body: "Dein Material rein — Foto, PDF, Text oder Link. Der schnellste Weg von vorhandenem Lernstoff zu digitalen Karten.",
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

const features: { Icon: IconType; tint: string; title: string; body: string }[] = [
  {
    Icon: Camera,
    tint: "g-indigo",
    title: "Foto & KI-Erstellung",
    body: "Foto, PDF, Text oder Link rein — OCR liest den Inhalt, die KI baut fertige Frage-Antwort-Karten. Kein Abtippen.",
  },
  {
    Icon: Repeat,
    tint: "g-green",
    title: "Spaced Repetition",
    body: "Ein modernes FSRS-Verfahren plant jede Wiederholung optimal — du lernst weniger und behältst mehr.",
  },
  {
    Icon: Target,
    tint: "g-pink",
    title: "Mehrere Lernmodi",
    body: "Karteikarten, Multiple Choice, Zuordnen und Lückentext — dasselbe Deck aus verschiedenen Blickwinkeln.",
  },
  {
    Icon: Folder,
    tint: "g-amber",
    title: "Kurse & Ordner",
    body: "Ordne deine Decks in Kursen und Ordnern — klare Struktur für jedes Fach statt einer langen Liste.",
  },
  {
    Icon: Share,
    tint: "g-violet",
    title: "Teilen & übernehmen",
    body: "Decks per Link teilen — andere übernehmen sie als eigene Kopie mit frischem Lernfortschritt.",
  },
  {
    Icon: Flame,
    tint: "g-blue",
    title: "Streaks & Lernpunkte",
    body: "Tagesziele, Serien und Statistiken — plus Lernpunkte, die du dir durchs Lernen verdienst und für KI-Funktionen einsetzt.",
  },
];

const modes: { Icon: IconType; tint: string; title: string; desc: string }[] = [
  { Icon: Layers, tint: "g-indigo", title: "Karteikarten", desc: "Klassisch umdrehen & bewerten" },
  { Icon: ListChecks, tint: "g-violet", title: "Multiple Choice", desc: "Antwort aus Optionen wählen" },
  { Icon: Match, tint: "g-pink", title: "Zuordnen", desc: "Begriffe & Definitionen paaren" },
  { Icon: Pencil, tint: "g-green", title: "Lückentext", desc: "Fehlendes aktiv ergänzen" },
];

const faqs = [
  {
    q: "Kann ich clearn im Browser nutzen?",
    a: "Ja! Registriere dich auf clearn-web.vercel.app und leg sofort los — ganz ohne Installation. Zusätzlich gibt es clearn als iPhone-App (aktuell über TestFlight).",
  },
  {
    q: "Was kostet clearn? Was ist gratis, was Pro?",
    a: "Starten ist kostenlos: Konto anlegen, Decks & Karten erstellen und lernen — inklusive Spaced Repetition, allen Lernmodi, Kurse & Ordner, Teilen und Statistik. Das KI-Erstellen läuft über Lernpunkte, die du dir durchs Lernen verdienst. Mit Pro gibt es mehr: mehr Decks & Karten, PDF-Import, Bild-Occlusion, Offline-Download, günstigere KI-Kosten und monatliche Lernpunkte.",
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
    a: "Im Browser auf jedem Gerät und als iPhone-App. Deine Decks sind an dein Konto gebunden, synchron auf allen Geräten — und offline verfügbar.",
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
  operatingSystem: "Web, iOS",
  description:
    "clearn verwandelt Fotos, Screenshots, PDFs, Texte und Links in strukturierte Flashcards und lässt dich mit Spaced Repetition effizient lernen — im Browser und als iPhone-App.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__copy">
              <span className="pill pill-dark">
                <span className="dot" /> Im Browser & als iPhone-App
              </span>
              <h1 className="h-display">
                Lernmaterial rein.
                <br />
                <span className="gradient-text">Flashcards raus.</span>
              </h1>
              <p className="lead">
                clearn verwandelt Fotos, Screenshots, PDFs, Texte und Links in klare Lernkarten.
                Lerne direkt im Browser oder unterwegs am iPhone — mit Spaced Repetition, die dir
                genau die Karten bringt, die heute dran sind.
              </p>
              <div className="hero__cta">
                <Link href="/signup" className="btn btn-primary btn-lg">
                  Kostenlos starten
                </Link>
                <a
                  href={landingCtas.primary.href}
                  className="btn btn-on-dark btn-lg"
                  data-event={JSON.stringify(landingCtas.primary.event)}
                >
                  Als iPhone-App
                </a>
              </div>
              <div className="hero__meta">
                <span>
                  <Check size={16} /> Ohne Installation im Browser
                </span>
                <span>
                  <ShieldCheck size={16} /> Datenschutz-first
                </span>
                <span>
                  <MapPin size={16} /> Made in Austria
                </span>
              </div>
            </div>

            {/* Phone mockup with floating chips */}
            <div className="hero__visual" aria-hidden>
              <div className="float-card float-card--a">
                <span className="ic g-indigo">
                  <Camera size={16} />
                </span>{" "}
                Foto gescannt
              </div>
              <div className="float-card float-card--b">
                <span className="ic g-green">
                  <CheckCircle size={16} />
                </span>{" "}
                24 Karten erstellt
              </div>
              <div className="float-card float-card--c">
                <span className="ic g-amber">
                  <Flame size={16} />
                </span>{" "}
                7-Tage-Streak
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
                    <span>Tippen zum Umdrehen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Sources strip (matches the app's capture screen) ---------------- */}
        <div className="trust">
          <div className="container trust__inner">
            <span className="trust__lead">KI macht Karten aus:</span>
            {sources.map(({ Icon, label }) => (
              <span key={label} className="trust__item">
                <Icon size={18} /> <b>{label}</b>
              </span>
            ))}
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

        {/* ---------------- Features (single overview of all capabilities) ---------------- */}
        <section id="features" className="section" style={{ background: "var(--bg-soft)" }}>
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow-chip">Features</span>
              <h2 className="h2">Alles, was gutes Lernen braucht</h2>
              <p className="lead">
                Von der Erfassung bis zur Bestenliste — clearn deckt den ganzen Lernweg ab.
              </p>
            </div>
            <div className="grid grid-3">
              {features.map(({ Icon, tint, title, body }) => (
                <article key={title} className="card reveal">
                  <div className={`card__icon ${tint}`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="h3">{title}</h3>
                  <p>{body}</p>
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
                  <span className="pill">
                    <Check size={14} /> Übernehmen
                  </span>
                  <span
                    className="pill"
                    style={{
                      background: "var(--bg-softer)",
                      color: "var(--ink-3)",
                      borderColor: "var(--line)",
                    }}
                  >
                    <Pencil size={14} /> Bearbeiten
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
                  <span className="tick">
                    <Check size={13} strokeWidth={3} />
                  </span>{" "}
                  Verschiedenste Quellen — von der Handykamera bis zum PDF
                </li>
                <li>
                  <span className="tick">
                    <Check size={13} strokeWidth={3} />
                  </span>{" "}
                  Mathematische Formeln werden sauber erkannt
                </li>
                <li>
                  <span className="tick">
                    <Check size={13} strokeWidth={3} />
                  </span>{" "}
                  Jede Karte bleibt vollständig bearbeitbar
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
                mehreren Modi an.
              </p>
            </div>

            <div className="split" style={{ marginBottom: 40 }}>
              <div className="reveal">
                <div className="modes">
                  {modes.map(({ Icon, tint, title, desc }) => (
                    <div key={title} className="mode">
                      <span className={`ic ${tint}`}>
                        <Icon size={20} />
                      </span>
                      <div>
                        <b>{title}</b>
                        <span>{desc}</span>
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

        {/* ---------------- Everywhere: browser + app ---------------- */}
        <section className="section">
          <div className="container split">
            <div className="split__media reveal">
              <div
                style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}
                aria-hidden
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ marginLeft: 6, fontSize: "0.8rem", color: "var(--ink-3)", fontWeight: 600 }}>
                  clearn-web.vercel.app
                </span>
              </div>
              <div className="stack">
                <div className="mini-card" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <span className="ic g-indigo" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", flex: "none" }}>
                    <Layers size={17} />
                  </span>
                  <div style={{ display: "grid", gap: 2 }}>
                    <strong>Biologie · Zellorganellen</strong>
                    <span>24 Karten</span>
                  </div>
                </div>
                <div className="mini-card" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <span className="ic g-violet" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", flex: "none" }}>
                    <Layers size={17} />
                  </span>
                  <div style={{ display: "grid", gap: 2 }}>
                    <strong>Geschichte · Antike</strong>
                    <span>18 Karten</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="reveal">
              <span className="eyebrow">Überall lernen</span>
              <h2 className="h2" style={{ marginBlock: "14px 16px" }}>
                Im Browser oder als App — immer synchron
              </h2>
              <p className="lead">
                clearn läuft direkt im Browser: registrieren und sofort loslegen, ganz ohne
                Installation. Oder als iPhone-App für unterwegs. Deine Decks sind auf allen Geräten
                gleich — und offline verfügbar.
              </p>
              <ul className="reset check-list">
                <li>
                  <span className="tick">
                    <Globe size={13} strokeWidth={2.5} />
                  </span>{" "}
                  Im Browser nutzen — keine Installation nötig
                </li>
                <li>
                  <span className="tick">
                    <Smartphone size={13} strokeWidth={2.5} />
                  </span>{" "}
                  Als iPhone-App (aktuell über TestFlight)
                </li>
                <li>
                  <span className="tick">
                    <Check size={13} strokeWidth={3} />
                  </span>{" "}
                  Deine Decks automatisch synchron auf allen Geräten
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- Stats band ---------------- */}
        <section className="section-sm">
          <div className="container">
            <div className="stat-band reveal">
              <div className="stat">
                <b>5</b>
                <span>Quellen (Foto bis PDF)</span>
              </div>
              <div className="stat">
                <b>FSRS</b>
                <span>Modernes Spaced-Repetition-Verfahren</span>
              </div>
              <div className="stat">
                <b>4</b>
                <span>Lernmodi</span>
              </div>
              <div className="stat">
                <b>Sync</b>
                <span>synchron auf allen Geräten</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Retention / stats / friends split ---------------- */}
        <section className="section">
          <div className="container split split--reverse">
            <div className="split__media reveal">
              <div className="stack">
                <div className="mini-card">
                  <small>Fortschritt</small>
                  <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Flame size={16} style={{ color: "var(--amber)" }} /> 7-Tage-Streak
                  </strong>
                  <div className="mini-bar">
                    <i style={{ width: "86%" }} />
                  </div>
                  <span>Tagesziel fast geschafft — noch 3 Karten</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="mini-card center">
                    <strong
                      style={{
                        fontSize: "1.4rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      <Zap size={16} style={{ color: "var(--amber)" }} /> 240
                    </strong>
                    <span>Lernpunkte verdient</span>
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
                  <span className="tick">
                    <Check size={13} strokeWidth={3} />
                  </span>{" "}
                  Tägliche Serie, Tagesziele & Streaks
                </li>
                <li>
                  <span className="tick">
                    <Zap size={13} strokeWidth={2.5} />
                  </span>{" "}
                  Lernpunkte fürs Lernen — für KI-Funktionen einsetzbar
                </li>
                <li>
                  <span className="tick">
                    <Check size={13} strokeWidth={3} />
                  </span>{" "}
                  Statistiken zu Streak, Trefferquote & Fortschritt
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
                      <Plus size={18} />
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
              <span className="pill pill-dark">Kostenlos starten</span>
              <h2 className="h2">Fang heute an, klüger zu lernen</h2>
              <p className="lead" style={{ color: "rgba(255,255,255,0.9)" }}>
                Registriere dich in Sekunden im Browser — oder hol dir die iPhone-App. Dein erstes
                Lernmaterial wird im Nu zu Flashcards.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                <Link href="/signup" className="btn btn-ghost btn-lg">
                  Kostenlos starten
                </Link>
                <a href={landingCtas.primary.href} className="btn btn-on-dark btn-lg">
                  Als iPhone-App
                </a>
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
