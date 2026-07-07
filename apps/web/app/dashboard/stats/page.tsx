"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStats, isApiError, type StatsResponse } from "@/lib/api";
import { Flame, Clock, CheckCircle, Target, BarChart } from "@/components/icons";

export default function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getStats()
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
  }, []);

  if (loading) return <div className="spinner" />;

  if (error || !stats) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <BarChart size={30} />
        </div>
        <h3>Noch keine Statistik</h3>
        <p>{error ?? "Sobald du lernst, erscheinen hier deine Fortschritte."}</p>
        <Link href="/dashboard" className="btn btn-primary">
          Zur Bibliothek
        </Link>
      </div>
    );
  }

  const accuracy = Math.round(
    stats.accuracyRate <= 1 ? stats.accuracyRate * 100 : stats.accuracyRate
  );
  const goalPct =
    stats.dailyGoal > 0
      ? Math.min(100, Math.round((stats.reviewsToday / stats.dailyGoal) * 100))
      : 0;

  const days = stats.reviewsByDay.slice(-14);
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const tiles = [
    { Icon: Flame, value: stats.currentStreak, label: "Tage-Streak" },
    { Icon: Clock, value: stats.dueCards, label: "Jetzt fällig" },
    { Icon: CheckCircle, value: stats.reviewsToday, label: "Heute wiederholt" },
    { Icon: Target, value: `${accuracy}%`, label: "Trefferquote" },
  ];

  return (
    <>
      <div className="lib-head">
        <div>
          <h1>Statistik</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Dein Lernfortschritt auf einen Blick
          </p>
        </div>
      </div>

      <div className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <span className="ic" aria-hidden style={{ color: "var(--brand-600)" }}>
              <t.Icon size={22} />
            </span>
            <b>{t.value}</b>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", marginBottom: 16 }}>
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <h3 className="h3">Tagesziel</h3>
            <span className="muted" style={{ fontWeight: 700 }}>
              {stats.reviewsToday} / {stats.dailyGoal || "—"}
            </span>
          </div>
          <div className="progress" style={{ height: 12 }}>
            <i style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 className="h3" style={{ marginBottom: 6 }}>
          Aktivität (14 Tage)
        </h3>
        {days.length === 0 ? (
          <p className="muted">Noch keine Wiederholungen aufgezeichnet.</p>
        ) : (
          <div className="bars" title="Wiederholungen pro Tag">
            {days.map((d) => (
              <div
                key={d.date}
                className="bar"
                style={{ height: `${(d.count / maxCount) * 100}%` }}
                title={`${d.date}: ${d.count}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat-tile">
          <b>{stats.longestStreak}</b>
          <span>Längste Serie (Tage)</span>
        </div>
        <div className="stat-tile">
          <b>{stats.reviewsThisWeek}</b>
          <span>Diese Woche</span>
        </div>
        <div className="stat-tile">
          <b>{stats.reviewsTotal}</b>
          <span>Insgesamt</span>
        </div>
        <div className="stat-tile">
          <b>{stats.totalDecks}</b>
          <span>Decks</span>
        </div>
      </div>
    </>
  );
}
