import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { SiteFrame } from "@/components/site-frame";
import { landingCtas } from "@/lib/landing";

const API_BASE_URL = (process.env.CLEARN_API_BASE_URL ?? "https://clearn-api.vercel.app").replace(
  /\/+$/,
  ""
);

const MAX_PREVIEW_CARDS = 30;

interface SharedDeck {
  id: string;
  title: string;
  tags: string[];
  cardCount?: number;
}

interface SharedCard {
  id: string;
  front: string;
  back: string;
}

type SharedDeckResult =
  | { status: "ok"; deck: SharedDeck; cards: SharedCard[] }
  | { status: "not-found" }
  | { status: "error" };

const getSharedDeck = cache(async (token: string): Promise<SharedDeckResult> => {
  if (!token || token.length > 100) return { status: "not-found" };
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/decks/share/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return { status: "not-found" };
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as { deck: SharedDeck; cards?: SharedCard[] };
    if (!data.deck) return { status: "error" };
    return { status: "ok", deck: data.deck, cards: data.cards ?? [] };
  } catch {
    return { status: "error" };
  }
});

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await getSharedDeck(token);
  if (result.status !== "ok") {
    return { title: "Geteiltes Deck – clearn.ai" };
  }
  return {
    title: `${result.deck.title} – geteiltes Deck | clearn.ai`,
    description: `Lernkarten-Deck „${result.deck.title}“ — geteilt mit clearn.`,
  };
}

export default async function SharedDeckPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getSharedDeck(token);

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <SiteFrame>
        <section
          style={{
            padding: "34px 28px",
            borderRadius: 28,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(15,23,42,0.08)",
            display: "grid",
            gap: 12,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 32, color: "#0f172a" }}>
            Deck gerade nicht erreichbar
          </h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, maxWidth: 640 }}>
            Das geteilte Deck konnte nicht geladen werden. Bitte versuch es in ein paar Minuten
            noch einmal.
          </p>
          <Link href="/" style={{ color: "#4338ca", fontWeight: 700, textDecoration: "none" }}>
            Zur Startseite
          </Link>
        </section>
      </SiteFrame>
    );
  }

  const { deck, cards } = result;
  const cardCount = deck.cardCount ?? cards.length;
  const previewCards = cards.slice(0, MAX_PREVIEW_CARDS);
  const remaining = cards.length - previewCards.length;

  return (
    <SiteFrame>
      <section
        style={{
          display: "grid",
          gap: 18,
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
          Geteiltes Deck
        </div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>{deck.title}</h1>
        <p style={{ margin: 0, color: "#dbe4ff", fontSize: 17 }}>
          {cardCount} {cardCount === 1 ? "Karte" : "Karten"}
          {deck.tags.length > 0 ? ` · ${deck.tags.join(", ")}` : ""}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a
            href={landingCtas.primary.href}
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
            {landingCtas.primary.label}
          </a>
          <Link
            href="/"
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
            Was ist clearn?
          </Link>
        </div>
      </section>

      <section style={{ display: "grid", gap: 12, marginTop: 22 }}>
        {previewCards.map((card, index) => (
          <div
            key={card.id}
            style={{
              padding: 20,
              borderRadius: 22,
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: "0 22px 60px rgba(15,23,42,0.08)",
              display: "grid",
              gap: 8,
            }}
          >
            <span style={{ color: "#6366f1", fontWeight: 700, fontSize: 13 }}>
              Karte {index + 1}
            </span>
            <strong style={{ fontSize: 18, color: "#0f172a", lineHeight: 1.5 }}>
              {card.front}
            </strong>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>{card.back}</p>
          </div>
        ))}
        {remaining > 0 && (
          <p style={{ margin: "6px 4px", color: "#475569" }}>
            … und {remaining} weitere {remaining === 1 ? "Karte" : "Karten"}.
          </p>
        )}
        {cards.length === 0 && (
          <p style={{ margin: "6px 4px", color: "#475569" }}>
            Dieses Deck enthält noch keine Karten.
          </p>
        )}
      </section>
    </SiteFrame>
  );
}
