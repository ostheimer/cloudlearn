"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getStats,
  getDeckSummaries,
  isApiError,
  type StatsResponse,
  type DeckSummary,
} from "@/lib/api";
import { BarChart, TrendingUp } from "@/components/icons";
import { AccuracyRing, AccuracyTrendChart, ActivityBars } from "@/components/app/stats-charts";

function accColor(rate: number): string {
  const pct = rate <= 1 ? rate * 100 : rate;
  if (pct < 50) return "#e2504a";
  if (pct < 75) return "#d97706";
  return "#16a34a";
}

export default function StatsPage() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(30);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [decksErr, setDecksErr] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStats(rangeDays)
      .then(({ stats }) => {
        if (active) setStats(stats);
      })
      .catch((e) => {
        if (active) setError(isApiError(e) ? e.message : "Statistik nicht verfügbar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rangeDays]);

  useEffect(() => {
    let active = true;
    getDeckSummaries()
      .then(({ decks }) => {
        if (active) setDecks(decks);
      })
      .catch(() => {
        if (active) setDecksErr(true);
      });
  }, []);

  if (loading && !stats) return <div className="spinner" />;

  if (error && !stats) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <BarChart size={30} />
        </div>
        <h3>Noch keine Statistik</h3>
        <p>{error}</p>
        <Link href="/dashboard" className="btn btn-primary">
          Zur Bibliothek
        </Link>
      </div>
    );
  }

  const accuracyByDay = stats?.accuracyByDay ?? [];
  const learningDays = accuracyByDay.filter((d) => d.count > 0).length;
  const reviewsByDay = stats?.reviewsByDay ?? [];
  const hasReviews = (stats?.reviewsTotal ?? 0) > 0;
  const accRate = stats ? (stats.accuracyRate <= 1 ? stats.accuracyRate : stats.accuracyRate / 100) : 0;

  const sortedDecks = decks
    ? [...decks].sort((a, b) => {
        // Decks ohne Antworten ans Ende, sonst schwächstes zuerst.
        if (a.answersTotal === 0 && b.answersTotal > 0) return 1;
        if (b.answersTotal === 0 && a.answersTotal > 0) return -1;
        return a.accuracyRate - b.accuracyRate;
      })
    : null;

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
      <div className="lib-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1>Statistik</h1>
        <div
          style={{
            display: "inline-flex",
            background: "var(--bg-soft)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: 3,
            flex: "none",
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
          <AccuracyRing accuracy={accRate} hasData={hasReviews} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="muted" style={{ fontSize: "0.8rem", marginBottom: 4 }}>
              Verlauf — letzte {rangeDays} Tage
            </div>
            {learningDays >= 2 ? (
              <AccuracyTrendChart data={accuracyByDay} showAllDates={rangeDays === 7} />
            ) : (
              <p className="muted" style={{ fontSize: "0.85rem", margin: "18px 0" }}>
                {hasReviews
                  ? "Verlauf erscheint ab 2 Lern-Tagen."
                  : `Keine Antworten in den letzten ${rangeDays} Tagen.`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Karten pro Tag */}
      <div className="panel">
        <h3 className="h3" style={{ marginBottom: 6 }}>
          Karten pro Tag
        </h3>
        {reviewsByDay.some((d) => d.count > 0) ? (
          <ActivityBars data={reviewsByDay} showAllDates={rangeDays === 7} />
        ) : (
          <p className="muted" style={{ margin: "10px 0" }}>
            {hasReviews
              ? `Keine Wiederholungen in den letzten ${rangeDays} Tagen.`
              : "Noch keine Wiederholungen. Lerne los, dann füllt sich dieser Verlauf."}
          </p>
        )}
      </div>

      {/* Pro Deck */}
      <div className="panel">
        <h3 className="h3" style={{ marginBottom: 2 }}>
          Pro Deck
        </h3>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 12px" }}>
          Genauigkeit der letzten 30 Tage — schwächstes zuerst
        </p>
        {sortedDecks === null ? (
          decksErr ? (
            <p className="muted">Pro-Deck-Statistik konnte nicht geladen werden.</p>
          ) : (
            <div className="spinner" style={{ margin: "10px auto" }} />
          )
        ) : sortedDecks.length === 0 ? (
          <p className="muted">Noch keine Decks — leg eins an, dann siehst du hier den Vergleich.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sortedDecks.map((d) => {
              const pct = Math.round(d.accuracyRate <= 1 ? d.accuracyRate * 100 : d.accuracyRate);
              const noData = d.answersTotal === 0;
              return (
                <div
                  key={d.deckId}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.92rem",
                    }}
                  >
                    {d.title}
                  </span>
                  {noData ? (
                    <span className="muted" style={{ fontSize: "0.8rem" }}>
                      noch keine Antworten
                    </span>
                  ) : (
                    <>
                      <span
                        style={{
                          width: 110,
                          height: 8,
                          background: "var(--bg-soft)",
                          borderRadius: 4,
                          overflow: "hidden",
                          flex: "none",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            width: `${pct}%`,
                            height: "100%",
                            background: accColor(d.accuracyRate),
                          }}
                        />
                      </span>
                      <b style={{ width: 38, textAlign: "right", fontSize: "0.85rem" }}>{pct}%</b>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Kennzahlen */}
      <div className="stat-grid" style={{ marginTop: 4 }}>
        <div className="stat-tile">
          <span className="ic" aria-hidden style={{ color: "var(--brand-600)" }}>
            <TrendingUp size={20} />
          </span>
          <b>{stats?.reviewsThisWeek ?? 0}</b>
          <span>Diese Woche</span>
        </div>
        <div className="stat-tile">
          <b>{stats?.reviewsTotal ?? 0}</b>
          <span>Insgesamt</span>
        </div>
        <div className="stat-tile">
          <b>{stats?.longestStreak ?? 0}</b>
          <span>Längste Serie</span>
        </div>
        <div className="stat-tile">
          <b>{stats?.totalDecks ?? 0}</b>
          <span>Decks</span>
        </div>
      </div>
    </>
  );
}
