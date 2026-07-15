"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDeckStats, isApiError, type DeckStats } from "@/lib/api";
import { ArrowLeft, RotateCw } from "@/components/icons";
import { AccuracyRing, AccuracyTrendChart } from "@/components/app/stats-charts";

export default function DeckStatsPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState<7 | 30>(30);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deckId) return;
    let active = true;
    setLoading(true);
    getDeckStats(deckId, rangeDays)
      .then((s) => {
        if (active) setStats(s);
      })
      .catch((e) => {
        if (active) setError(isApiError(e) ? e.message : "Deck-Statistik nicht verfügbar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deckId, rangeDays]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard/stats");
  };

  if (loading && !stats) return <div className="spinner" />;

  if (error && !stats) {
    return (
      <div className="empty-state">
        <h3>Deck-Statistik nicht verfügbar</h3>
        <p>{error}</p>
        <Link href="/dashboard/stats" className="btn btn-primary">
          Zur Statistik
        </Link>
      </div>
    );
  }

  const answersTotal = stats?.answersTotal ?? 0;
  const acc = answersTotal > 0 ? (stats?.answersCorrect ?? 0) / answersTotal : 0;
  const accuracyByDay = stats?.accuracyByDay ?? [];
  const learningDays = accuracyByDay.filter((d) => d.count > 0).length;
  const wobbly = stats?.wobblyCards ?? [];

  const seg = (days: 7 | 30, label: string) => (
    <button
      type="button"
      onClick={() => setRangeDays(days)}
      style={{
        padding: "5px 14px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontSize: "0.85rem",
        fontWeight: 600,
        background: rangeDays === days ? "var(--brand)" : "transparent",
        color: rangeDays === days ? "#fff" : "var(--ink-3)",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="lib-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Zurück"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)", display: "inline-flex" }}
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {stats?.deck.title ?? "Deck"}
            </h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Statistik für dieses Deck
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <div
          style={{
            display: "inline-flex",
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: 3,
          }}
        >
          {seg(7, "7 Tage")}
          {seg(30, "30 Tage")}
        </div>
      </div>

      {/* Genauigkeit — Ring + Verlauf */}
      <div className="panel">
        <h3 className="h3" style={{ marginBottom: 12 }}>
          Genauigkeit
        </h3>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <AccuracyRing accuracy={acc} hasData={answersTotal > 0} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: "0.8rem", marginBottom: 4 }}>
              Verlauf — letzte {rangeDays} Tage
              {learningDays >= 2 && " · Punkt antippen für Details"}
            </div>
            {learningDays >= 2 ? (
              <AccuracyTrendChart data={accuracyByDay} showAllDates={rangeDays === 7} />
            ) : (
              <p className="muted" style={{ fontSize: "0.85rem", margin: "18px 0" }}>
                {answersTotal > 0
                  ? "Verlauf erscheint ab 2 Lern-Tagen."
                  : `Keine Antworten in den letzten ${rangeDays} Tagen.`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Wackelkandidaten */}
      <div className="panel">
        <h3 className="h3" style={{ marginBottom: 12 }}>
          Deine Wackelkandidaten
        </h3>
        {wobbly.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {wobbly.map((card) => (
              <div
                key={card.cardId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "var(--bg-soft)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: "0.9rem",
                  }}
                >
                  {card.front}
                </span>
                <span
                  style={{
                    background: "rgba(220,38,38,0.10)",
                    color: "#dc2626",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flex: "none",
                  }}
                >
                  {card.wrongCount}× falsch
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            {answersTotal > 0
              ? "Keine Wackelkandidaten — alle Karten sitzen."
              : "Sobald du hier lernst, zeigen wir dir die Karten, die am häufigsten schiefgehen."}
          </p>
        )}
      </div>

      {wobbly.length > 0 && (
        <Link
          href={`/dashboard/deck/${deckId}/learn?cards=${wobbly.map((w) => w.cardId).join(",")}`}
          className="btn btn-primary btn-lg btn-block"
          style={{ textDecoration: "none", gap: 8 }}
        >
          <RotateCw size={18} /> Wackelkandidaten üben ({wobbly.length})
        </Link>
      )}
    </>
  );
}
