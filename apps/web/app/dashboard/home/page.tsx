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
import { useDisplayName } from "@/lib/use-display-name";
import { consumeFreshWelcome } from "@/lib/onboarding";
import { useAuth } from "@/components/app/auth-context";
import {
  Flame,
  Target,
  TrendingUp,
  Layers,
  Users,
  BookOpen,
  ChevronRight,
  Shield,
  Zap,
  ScanLine,
  Award,
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
  // Anzeigename für die persönliche Begrüßung — ohne ihn bleibt es beim
  // schlichten "Willkommen zurück".
  const displayName = useDisplayName();
  // Direkt nach der Einführung wäre „zurück" gelogen — die Einmal-Notiz
  // aus dem Onboarding macht daraus beim allerersten Besuch „Willkommen".
  // Im Effekt statt im Initial-State, weil der Server-HTML-Stand sonst
  // nicht zum ersten Client-Render passt (Hydration).
  const [freshWelcome, setFreshWelcome] = useState(false);
  useEffect(() => {
    if (consumeFreshWelcome()) setFreshWelcome(true);
  }, []);
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

  // Kacheln wie die App (apps/mobile/app/(tabs)/index.tsx): Symbol in einem
  // gerundeten Kästchen OBEN, darunter die große Zahl, darunter die
  // Bezeichnung, unten die Pille. Alle drei stehen nebeneinander — deshalb
  // flex mit minWidth 0 statt eines Rasters mit Mindestbreite, sonst bricht
  // die dritte Kachel am Handy um.
  const tileStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "12px 6px",
    textDecoration: "none",
    color: "inherit",
    boxShadow: "var(--shadow-sm)",
  };
  const tileIconBox = (tone: "brand" | "good" | "muted"): CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    marginBottom: 8,
    flex: "none",
    background:
      tone === "good"
        ? "rgba(16,185,129,0.14)"
        : tone === "brand"
          ? "rgba(99,102,241,0.12)"
          : "var(--bg-soft)",
    color: tone === "good" ? "#059669" : tone === "brand" ? "var(--brand)" : "var(--ink-4)",
  });
  const tileNum: CSSProperties = {
    fontSize: "1.375rem",
    fontWeight: 800,
    color: "var(--ink)",
    lineHeight: 1.15,
  };
  const tileLabel: CSSProperties = {
    fontSize: "0.72rem",
    color: "var(--ink-3)",
    marginTop: 2,
    textAlign: "center",
  };
  const tileHint: CSSProperties = {
    fontSize: "0.68rem",
    color: "var(--ink-4)",
    textAlign: "center",
  };
  const badge = (amber: boolean): CSSProperties => ({
    marginTop: 6,
    fontSize: "0.68rem",
    fontWeight: 700,
    whiteSpace: "nowrap",
    color: amber ? "var(--amber)" : "var(--brand)",
    background: amber ? "var(--amber-50)" : "var(--bg-soft)",
    borderRadius: 999,
    padding: "2px 8px",
  });

  return (
    // minmax(0, 1fr) statt der voreingestellten auto-Spalte: Sonst richtet sich
    // die Spaltenbreite nach dem sperrigsten Kind. Der Deck-Titel in „Zuletzt
    // genutzt" steht auf nowrap und meldet trotz overflow:hidden seine volle
    // Textbreite — damit blies ein langer Titel die Seite am Handy auf 520px
    // (Bildschirm 390px) und schob Karten und Tab-Leiste über den Rand.
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 14,
      }}
    >
      {/* Kopf wie die App-Startseite: großer Wortmarken-Titel, darunter eine
          Unterzeile, rechts die LP-Pille. Die App schreibt dort ihren Claim;
          der persönliche Gruß aus PR #539 bleibt erhalten und übernimmt die
          Unterzeile, sobald ein Anzeigename da ist. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
            clearn
          </h1>
          <p className="muted" style={{ margin: "2px 0 0" }}>
            {displayName
              ? `${freshWelcome ? "Willkommen" : "Willkommen zurück"}, ${displayName}`
              : "Foto — Karte — Wissen"}
          </p>
        </div>
        <Link href="/dashboard/lp" className="lp-pill" style={{ textDecoration: "none", flex: "none" }}>
          <Zap size={15} /> {lp !== null ? `${lp} LP` : error ? "–" : "…"}
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
          // min(100%, …) statt 300px: Ohne die Klammer ist das Spalten-Minimum
          // hart und schiebt die Seite am Handy über den Bildschirmrand.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 12,
        }}
      >
        {/* Gelb-orange wie das Streak-Banner der App — nicht Brand-Violett;
            Laras Wunsch 23.07.: „das helle von der App, wirkt fröhlicher". */}
        <Link
          href="/dashboard/streak-calendar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            background: "var(--amber-50)",
            border: "1px solid var(--amber)",
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
              borderRadius: 999,
              background: "rgba(245, 158, 11, 0.18)",
              color: "var(--amber)",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
            aria-hidden
          >
            <Flame size={24} />
          </span>
          {/* Große Tageszahl + Zuruf wie in der App: dort steht die Zahl groß
              („1 Tag") und darunter je nach Lage „Weiter so!", eine Erinnerung
              oder die Einladung zum Start. Der Bestwert sitzt rechts als
              eigene Spalte mit Auszeichnungs-Symbol, nicht in der Unterzeile. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--amber)", lineHeight: 1.1 }}>
              {streak} {streak === 1 ? "Tag" : "Tage"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: 2 }}>
              {streak === 0
                ? "Starte deinen Streak!"
                : today === 0
                  ? "Lerne heute, um deinen Streak zu halten!"
                  : "Weiter so!"}
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
          {best > 0 && (
            <span
              style={{
                display: "grid",
                justifyItems: "center",
                gap: 2,
                flex: "none",
                fontSize: "0.7rem",
                color: "var(--ink-4)",
              }}
            >
              <Award size={16} />
              Best: {best}
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
              {/* Schreibweise wie die App: „2/50 Karten", ohne Leerzeichen */}
              <span>
                <b style={{ color: "var(--ink)" }}>{today}</b>/{goal || "—"} Karten
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

      {/* Kennzahlen wie in der App: Freunde / Decks (mit fällig) / Genauigkeit —
          drei Kacheln in einer Reihe, Symbol im Kästchen über der Zahl. Flex
          statt Raster, damit sie am Handy nicht umbrechen (die App zeigt dort
          ebenfalls alle drei nebeneinander). */}
      <div style={{ display: "flex", gap: 8 }}>
        <Link
          href="/dashboard/friends"
          style={{
            ...tileStyle,
            borderColor: waitingPartner ? "var(--amber)" : "var(--line)",
          }}
        >
          <span style={tileIconBox("brand")} aria-hidden>
            <Users size={18} />
          </span>
          <span style={{ ...tileNum, display: "inline-flex", alignItems: "center", gap: 3 }}>
            {bestFriendStreak > 0 && <Flame size={15} style={{ color: "var(--amber)" }} />}
            {bestFriendStreak}
          </span>
          <span style={tileLabel}>Freunde</span>
          <span style={badge(false)}>Öffnen ›</span>
        </Link>

        <Link href="/dashboard" style={tileStyle}>
          <span style={tileIconBox("brand")} aria-hidden>
            <Layers size={18} />
          </span>
          <span style={tileNum}>{decks}</span>
          <span style={tileLabel}>Decks</span>
          <span style={badge(due > 0)}>{due > 0 ? `${due} fällig ›` : "Bibliothek ›"}</span>
        </Link>

        <Link href="/dashboard/stats" style={tileStyle}>
          {/* Grünes Kästchen ab 70 %, sonst grau — wie die App */}
          <span style={tileIconBox(hasAccuracyData && accuracy >= 70 ? "good" : "muted")} aria-hidden>
            <TrendingUp size={18} />
          </span>
          <span style={tileNum}>{hasAccuracyData ? `${accuracy}%` : "—"}</span>
          <span style={tileLabel}>Genauigkeit</span>
          <span style={tileHint}>letzte {accuracyWindowDays} Tage</span>
          <span style={badge(false)}>Statistik ›</span>
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
            {/* Beschriftung wie die App: „gelernt", wenn der Server das zuletzt
                gelernte Deck liefert — sonst stammt die Zeile aus der nach
                Änderung sortierten Deck-Liste, und dann wäre „gelernt" gelogen. */}
            <div style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>
              {stats?.lastStudiedDeck ? "Zuletzt gelernt" : "Zuletzt geändert"}
            </div>
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
        <ScanLine size={18} /> Neuen Text scannen
      </Link>
    </div>
  );
}
