"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  getStats,
  getDeckSummaries,
  isApiError,
  type StatsResponse,
  type DeckSummary,
} from "@/lib/api";
import { BarChart, ChevronRight, Flame } from "@/components/icons";
import { AccuracyRing, AccuracyTrendChart, ActivityBars } from "@/components/app/stats-charts";

function accColor(rate: number): string {
  const pct = rate <= 1 ? rate * 100 : rate;
  if (pct < 60) return "#e2504a";
  if (pct < 80) return "#d97706";
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
      .then(({ stats }) => active && setStats(stats))
      .catch((e) => active && setError(isApiError(e) ? e.message : "Statistik nicht verfügbar."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [rangeDays]);

  useEffect(() => {
    let active = true;
    getDeckSummaries()
      .then(({ decks }) => active && setDecks(decks))
      .catch(() => active && setDecksErr(true));
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
  const accPct = stats
    ? Math.round(stats.accuracyRate <= 1 ? stats.accuracyRate * 100 : stats.accuracyRate)
    : 0;
  const accRate = stats ? (stats.accuracyRate <= 1 ? stats.accuracyRate : stats.accuracyRate / 100) : 0;
  const goal = stats?.dailyGoal ?? 0;

  const sortedDecks = decks
    ? [...decks].sort((a, b) => {
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

  const ctxRow = (label: string, value: ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
      <span className="muted">{label}</span>
      <b style={{ color: "var(--ink)" }}>{value}</b>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Kopf + Zeitraum */}
      <div className="lib-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 0 }}>
        <div>
          <h1>Statistik</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Dein Lernfortschritt auf einen Blick
          </p>
        </div>
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

      {/* KPI-Reihe */}
      <div className="st-kpi">
        <div className="st-kpi-tile">
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Trefferquote
          </span>
          <b>{hasReviews ? `${accPct} %` : "—"}</b>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            {stats?.reviewsTotal ?? 0} Antworten
          </span>
        </div>
        <div className="st-kpi-tile">
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Diese Woche
          </span>
          <b>{stats?.reviewsThisWeek ?? 0}</b>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            heute: {stats?.reviewsToday ?? 0}
          </span>
        </div>
        <div className="st-kpi-tile">
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Insgesamt
          </span>
          <b>{stats?.reviewsTotal ?? 0}</b>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            {stats?.totalDecks ?? 0} Decks
          </span>
        </div>
        <div className="st-kpi-tile">
          <span className="muted" style={{ fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Flame size={13} /> Tage-Streak
          </span>
          <b>{stats?.currentStreak ?? 0}</b>
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Rekord: {stats?.longestStreak ?? 0}
          </span>
        </div>
      </div>

      {/* Hero: Trefferquote-Verlauf, volle Breite */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h3 className="h3" style={{ margin: 0 }}>
            Trefferquote-Verlauf
          </h3>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            letzte {rangeDays} Tage
            {learningDays >= 2 && " · Punkt antippen für Details"}
          </span>
        </div>
        {learningDays >= 2 ? (
          <AccuracyTrendChart data={accuracyByDay} showAllDates={rangeDays === 7} height={240} />
        ) : (
          <p className="muted" style={{ padding: "40px 0", textAlign: "center" }}>
            {hasReviews
              ? "Verlauf erscheint ab 2 Lern-Tagen."
              : "Noch keine Antworten. Lerne los, dann füllt sich der Verlauf."}
          </p>
        )}
      </div>

      {/* Karten pro Tag | Genauigkeit-Ring */}
      <div className="st-row2">
        <div className="panel">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <h3 className="h3" style={{ margin: 0 }}>
              Karten pro Tag
            </h3>
            {reviewsByDay.some((d) => d.count > 0) && (
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                für Details antippen
              </span>
            )}
          </div>
          {reviewsByDay.some((d) => d.count > 0) ? (
            <ActivityBars data={reviewsByDay} showAllDates={rangeDays === 7} height={210} />
          ) : (
            <p className="muted" style={{ padding: "30px 0", textAlign: "center" }}>
              {hasReviews
                ? `Keine Wiederholungen in den letzten ${rangeDays} Tagen.`
                : "Noch keine Wiederholungen."}
            </p>
          )}
        </div>
        <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <h3 className="h3" style={{ alignSelf: "flex-start", margin: 0 }}>
            Genauigkeit
          </h3>
          <AccuracyRing accuracy={accRate} hasData={hasReviews} size={128} />
          <div style={{ alignSelf: "stretch", display: "grid", gap: 8, marginTop: 2 }}>
            {ctxRow("Bester Streak", `${stats?.longestStreak ?? 0} Tage`)}
            {ctxRow("Decks", stats?.totalDecks ?? 0)}
            {ctxRow("Jetzt fällig", stats?.dueCards ?? 0)}
            {ctxRow("Tagesziel", `${stats?.reviewsToday ?? 0} / ${goal || "—"}`)}
          </div>
        </div>
      </div>

      {/* Pro Deck — volle Breite, klickbar */}
      <div className="panel">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <span className="h3">Pro Deck</span>
            <span className="muted" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
              schwächstes zuerst
            </span>
          </div>
          {sortedDecks && sortedDecks.length > 0 && (
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              für Details antippen
            </span>
          )}
        </div>
        {sortedDecks === null ? (
          decksErr ? (
            <p className="muted">Pro-Deck-Statistik konnte nicht geladen werden.</p>
          ) : (
            <div className="spinner" style={{ margin: "10px auto" }} />
          )
        ) : sortedDecks.length === 0 ? (
          <p className="muted">Noch keine Decks — leg eins an, dann siehst du hier den Vergleich.</p>
        ) : (
          <div>
            {sortedDecks.map((d) => {
              const pct = Math.round(d.accuracyRate <= 1 ? d.accuracyRate * 100 : d.accuracyRate);
              const noData = d.answersTotal === 0;
              return (
                <Link key={d.deckId} href={`/dashboard/deck-stats/${d.deckId}`} className="st-deck-row">
                  <span
                    style={{
                      flex: "1.4",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.95rem",
                    }}
                  >
                    {d.title}
                  </span>
                  {noData ? (
                    <span className="muted" style={{ flex: 1, fontSize: "0.8rem" }}>
                      noch keine Antworten
                    </span>
                  ) : (
                    <>
                      <span style={{ flex: 1, height: 9, background: "var(--bg-soft)", borderRadius: 5, overflow: "hidden" }}>
                        <span
                          style={{
                            display: "block",
                            width: `${pct}%`,
                            height: "100%",
                            background: accColor(d.accuracyRate),
                          }}
                        />
                      </span>
                      <b style={{ width: 42, textAlign: "right", fontSize: "0.9rem" }}>{pct}%</b>
                    </>
                  )}
                  <ChevronRight size={18} style={{ color: "var(--ink-4)", flex: "none" }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
