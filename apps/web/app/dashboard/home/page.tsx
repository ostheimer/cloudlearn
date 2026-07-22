"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  getStats,
  getLpBalance,
  getFriendStreaks,
  listDecks,
  buyStreakRepair,
  isApiError,
  type StatsResponse,
  type FriendStreak,
} from "@/lib/api";
import { useAuth } from "@/components/app/auth-context";
import {
  Flame,
  Target,
  Trophy,
  Layers,
  Users,
  BookOpen,
  ChevronRight,
  Shield,
  Zap,
  Camera,
  HeartCrack,
  HeartHandshake,
} from "@/components/icons";

// Startseite im Geist der App-Home: Streak (mit Freeze + Kalender-Link),
// Tagesziel, Kennzahl-Kacheln (Freunde/Decks/Genauigkeit), das zuletzt genutzte
// Deck und der Scan-Einstieg. Alles aus vorhandenen Daten — kein neues Backend.
export default function HomePage() {
  const { userId } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [lp, setLp] = useState<number | null>(null);
  const [friendStreaks, setFriendStreaks] = useState<FriendStreak[]>([]);
  const [recentDeck, setRecentDeck] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);

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

  // Freunde-Streaks best-effort — ein sozialer Fehler darf die Home nie brechen.
  useEffect(() => {
    getFriendStreaks()
      .then((r) => setFriendStreaks(r.streaks))
      .catch(() => setFriendStreaks([]));
  }, []);

  // Zuletzt bearbeitetes Deck für den "Zuletzt genutzt"-Wiedereinstieg.
  useEffect(() => {
    if (!userId) return;
    listDecks(userId)
      .then(({ decks }) => {
        if (decks.length === 0) return;
        const sorted = [...decks].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        const top = sorted[0];
        if (top) setRecentDeck({ id: top.id, title: top.title });
      })
      .catch(() => {});
  }, [userId]);

  if (loading) return <div className="spinner" />;

  const streak = stats?.currentStreak ?? 0;
  const best = stats?.longestStreak ?? 0;
  const due = stats?.dueCards ?? 0;
  const decks = stats?.totalDecks ?? 0;
  const goal = stats?.dailyGoal ?? 0;
  const today = stats?.reviewsToday ?? 0;
  const streakFreezes = stats?.streakFreezes ?? 0;
  const accuracy = stats
    ? Math.round(stats.accuracyRate <= 1 ? stats.accuracyRate * 100 : stats.accuracyRate)
    : 0;
  // "Genauigkeit" meint hier dasselbe wie auf der Statistik-Seite: die letzten
  // 30 Tage (Gratis-Konto: 7). Die Kachel schreibt das Fenster dazu, weil sie
  // — anders als die Statistik — keinen Umschalter hat, der es verrät.
  const accuracyWindowDays = stats?.statsWindowDays ?? 30;
  // Nach Antworten IN DIESEM Fenster fragen: `reviewsTotal` zählt ewig weiter
  // und hätte nach längerer Pause ein hartes "0 %" gezeigt, wo gar nichts
  // beantwortet wurde. Der Rückfall gilt nur für ältere APIs ohne das Feld.
  const hasAccuracyData = (stats?.reviewsInWindow ?? stats?.reviewsTotal ?? 0) > 0;
  const goalPct = goal > 0 ? Math.min(100, Math.round((today / goal) * 100)) : 0;

  const activeFriend = friendStreaks.filter((s) => s.status === "active");
  const bestFriendStreak = activeFriend.reduce((m, s) => Math.max(m, s.currentStreak), 0);
  const waitingPartner =
    activeFriend.find((s) => s.friendStudiedToday && !s.youStudiedToday) ?? null;

  const shownDeck = stats?.lastStudiedDeck ?? recentDeck;

  const repairAvailable = stats?.repairAvailable ?? false;
  const repairBrokenStreak = stats?.repairBrokenStreak ?? 0;
  const repairCost = stats?.repairCost ?? 40;

  // Gerissenen Streak gegen LP zurückholen. Preis/Berechtigung entscheidet der
  // Server; danach Werte neu laden, damit Banner und LP-Pille stimmen.
  const handleRepair = async () => {
    if (
      !window.confirm(
        `Deinen ${repairBrokenStreak}-Tage-Streak für ${repairCost} LP zurückholen?`
      )
    )
      return;
    setRepairing(true);
    setRepairMsg(null);
    try {
      await buyStreakRepair();
      await load();
    } catch (e) {
      const code = isApiError(e) ? e.code : undefined;
      setRepairMsg(
        code === "INSUFFICIENT_LP"
          ? "Dafür reichen deine LP noch nicht."
          : code === "NO_REPAIR"
            ? "Diese Reparatur ist nicht mehr möglich."
            : "Zurückholen fehlgeschlagen. Versuch es später noch einmal."
      );
    } finally {
      setRepairing(false);
    }
  };

  const tileStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "13px",
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
  const badge = (amber: boolean): CSSProperties => ({
    marginTop: 4,
    fontSize: "0.72rem",
    fontWeight: 700,
    color: amber ? "var(--amber)" : "var(--brand)",
    background: amber ? "var(--amber-50)" : "transparent",
    borderRadius: 999,
    padding: amber ? "1px 8px" : 0,
  });

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
          <Zap size={15} /> {lp !== null ? lp : error ? "–" : "…"}
        </Link>
      </div>

      {error && (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Konnte deine Werte gerade nicht laden — versuch es später nochmal.
        </p>
      )}

      {/* Streak-Reparatur — nur wenn ein frisch gerissener Streak zurückholbar ist */}
      {repairAvailable && (
        <div
          style={{
            background: "rgba(220,38,38,0.10)",
            border: "1px solid rgba(220,38,38,0.45)",
            borderRadius: 14,
            padding: "14px 16px",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: "var(--surface)",
                color: "#dc2626",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}
              aria-hidden
            >
              <HeartCrack size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>Streak gerissen</div>
              <div style={{ fontSize: "0.85rem", color: "var(--ink-3)" }}>
                Dein {repairBrokenStreak}-Tage-Streak ist weg
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleRepair}
            disabled={repairing}
            style={{ gap: 8 }}
          >
            {repairing ? (
              "Bitte warten…"
            ) : (
              <>
                <HeartHandshake size={16} /> Für {repairCost} LP zurückholen
              </>
            )}
          </button>
          {repairMsg && (
            <div style={{ fontSize: "0.85rem", color: "#dc2626", textAlign: "center" }}>
              {repairMsg}
            </div>
          )}
        </div>
      )}

      {/* Streak + Tagesziel — am Desktop nebeneinander, am Handy gestapelt */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        <Link
          href="/dashboard/streak-calendar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            background: "rgba(99,102,241,0.10)",
            borderRadius: 14,
            padding: "14px 16px",
            textDecoration: "none",
            color: "inherit",
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
          {streakFreezes > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--ink)",
                flex: "none",
              }}
            >
              <Shield size={14} style={{ color: "var(--amber)" }} /> {streakFreezes}
            </span>
          )}
        </Link>

        {/* Tagesziel — anklickbar wie in der App: führt zum Ziel-Editor */}
        <Link
          href="/dashboard/daily-goal"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "14px 16px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Target size={15} style={{ color: "var(--ink-3)" }} /> Tagesziel
            </div>
            <div className="muted" style={{ fontSize: "0.9rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span>
                <b style={{ color: "var(--ink)" }}>{today}</b> / {goal || "—"} Karten
              </span>
              <ChevronRight size={16} style={{ color: "var(--ink-4)" }} />
            </div>
          </div>
          <div className="progress">
            <i style={{ width: `${goalPct}%`, background: "var(--green)" }} />
          </div>
        </Link>
      </div>

      {/* Freunde-Hinweis: Partner hat heute gelernt, du noch nicht */}
      {waitingPartner && (
        <Link
          href="/dashboard/friends"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--amber-50)",
            border: "1px solid var(--amber)",
            borderRadius: 14,
            padding: "12px 16px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Users size={20} style={{ color: "var(--amber)", flex: "none" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {waitingPartner.displayName} hat heute gelernt
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
              Lern auch du, damit eure Flamme weiterbrennt
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--ink-4)", flex: "none" }} />
        </Link>
      )}

      {/* Kennzahlen — wie in der App: Freunde / Decks (mit fällig) / Genauigkeit */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Link
          href="/dashboard/friends"
          style={{
            ...tileStyle,
            borderColor: waitingPartner ? "var(--amber)" : "var(--line)",
          }}
        >
          <span style={tileLabel}>
            <Users size={14} /> Freunde
          </span>
          <span style={{ ...tileNum, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {bestFriendStreak > 0 && <Flame size={16} style={{ color: "var(--amber)" }} />}
            {bestFriendStreak}
          </span>
          <span style={badge(false)}>Öffnen ›</span>
        </Link>

        <Link href="/dashboard" style={tileStyle}>
          <span style={tileLabel}>
            <Layers size={14} /> Decks
          </span>
          <span style={tileNum}>{decks}</span>
          <span style={badge(due > 0)}>{due > 0 ? `${due} fällig ›` : "Bibliothek ›"}</span>
        </Link>

        <Link href="/dashboard/stats" style={tileStyle}>
          <span style={tileLabel}>
            <Trophy size={14} /> Genauigkeit
          </span>
          <span style={tileNum}>{hasAccuracyData ? `${accuracy} %` : "—"}</span>
          <span style={badge(false)}>letzte {accuracyWindowDays} Tage ›</span>
        </Link>
      </div>

      {/* Zuletzt genutztes Deck — Wiedereinstieg in genau ein Deck */}
      {shownDeck && (
        <Link
          href={`/dashboard/deck/${shownDeck.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "14px 16px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(99,102,241,0.12)",
              color: "var(--brand)",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
            aria-hidden
          >
            <BookOpen size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>Zuletzt genutzt</div>
            <div
              style={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shownDeck.title}
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--ink-4)", flex: "none" }} />
        </Link>
      )}

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
