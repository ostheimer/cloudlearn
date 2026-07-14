"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { getStats, getLpBalance, isApiError, type StatsResponse } from "@/lib/api";
import { Flame, Target, Clock, Trophy, Layers, Zap, Camera } from "@/components/icons";

// Startseite im Geist der App-Home: Streak, Tagesziel, ein paar Kennzahlen und
// der Scan-Einstieg — alles aus vorhandenen Daten (getStats + getLpBalance),
// kein neues Backend. Gelernt wird wie gehabt pro Deck über die Bibliothek.
export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [lp, setLp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, usage] = await Promise.all([getStats(), getLpBalance()]);
      setStats(statsRes.stats);
      setLp(usage.lpBalance);
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Konnte nicht laden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="spinner" />;

  const streak = stats?.currentStreak ?? 0;
  const best = stats?.longestStreak ?? 0;
  const due = stats?.dueCards ?? 0;
  const decks = stats?.totalDecks ?? 0;
  const goal = stats?.dailyGoal ?? 0;
  const today = stats?.reviewsToday ?? 0;
  const accuracy = stats
    ? Math.round(stats.accuracyRate <= 1 ? stats.accuracyRate * 100 : stats.accuracyRate)
    : 0;
  const goalPct = goal > 0 ? Math.min(100, Math.round((today / goal) * 100)) : 0;

  const tileStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "12px 13px",
    textDecoration: "none",
    color: "inherit",
  };
  const tileLabel: CSSProperties = {
    fontSize: "0.78rem",
    color: "var(--ink-3)",
    display: "flex",
    alignItems: "center",
    gap: 5,
  };
  const tileNum: CSSProperties = { fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)" };
  const tileGo: CSSProperties = { fontSize: "0.72rem", color: "var(--brand)", marginTop: 2 };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="h2" style={{ margin: 0 }}>
            Willkommen zurück
          </h1>
          <p className="muted" style={{ margin: "2px 0 0" }}>
            Bereit für heute?
          </p>
        </div>
        <Link href="/dashboard/lp" className="lp-pill" style={{ textDecoration: "none", flex: "none" }}>
          <Zap size={15} /> {lp !== null ? lp : "…"}
        </Link>
      </div>

      {error && (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Konnte deine Werte gerade nicht laden — versuch es später nochmal.
        </p>
      )}

      {/* Streak + Tagesziel — am Desktop nebeneinander, am Handy gestapelt */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          background: "rgba(99,102,241,0.10)",
          borderRadius: 14,
          padding: "14px 16px",
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--brand)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
          aria-hidden
        >
          <Flame size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--brand)" }}>
            {streak > 0 ? `${streak} ${streak === 1 ? "Tag" : "Tage"} Streak` : "Starte deinen Streak"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
            {streak > 0
              ? `Bestwert: ${best} ${best === 1 ? "Tag" : "Tage"}`
              : "Lerne heute eine Karte, um zu beginnen"}
          </div>
        </div>
      </div>

      {/* Tagesziel */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            <Target size={15} style={{ verticalAlign: -2, marginRight: 6, color: "var(--ink-3)" }} /> Tagesziel
          </div>
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            <b style={{ color: "var(--ink)" }}>{today}</b> / {goal || "—"} Karten
          </div>
        </div>
        <div className="progress">
          <i style={{ width: `${goalPct}%`, background: "var(--green)" }} />
        </div>
      </div>
      </div>

      {/* Kennzahlen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Link href="/dashboard" style={tileStyle}>
          <span style={tileLabel}>
            <Clock size={14} /> Heute fällig
          </span>
          <span style={tileNum}>{due}</span>
          <span style={tileGo}>Zur Bibliothek ›</span>
        </Link>
        <Link href="/dashboard/stats" style={tileStyle}>
          <span style={tileLabel}>
            <Trophy size={14} /> Genauigkeit
          </span>
          <span style={tileNum}>{accuracy} %</span>
          <span style={tileGo}>Zur Statistik ›</span>
        </Link>
        <Link href="/dashboard" style={tileStyle}>
          <span style={tileLabel}>
            <Layers size={14} /> Decks
          </span>
          <span style={tileNum}>{decks}</span>
          <span style={tileGo}>Zur Bibliothek ›</span>
        </Link>
      </div>

      {/* Haupt-Aktion */}
      <Link
        href="/dashboard/import"
        className="btn btn-primary btn-lg btn-block"
        style={{
          marginTop: 4,
          textDecoration: "none",
          width: "100%",
          maxWidth: 420,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <Camera size={18} /> Text scannen
      </Link>
    </div>
  );
}
