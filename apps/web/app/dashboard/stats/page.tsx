"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  getStats,
  getDeckSummaries,
  getLpBalance,
  getTestAttempts,
  isApiError,
  type StatsResponse,
  type DeckSummary,
  type TestAttemptSummary,
} from "@/lib/api";
import { BarChart, ChevronRight, Flame, Lock } from "@/components/icons";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { AccuracyRing, AccuracyTrendChart, ActivityBars } from "@/components/app/stats-charts";
import { AccuracyByKindPanel, accColor } from "@/components/app/accuracy-by-kind";
import { TestAttemptsPanel } from "@/components/app/test-attempts-panel";

export default function StatsPage() {
  // Startet auf 7 (dem Free-Fenster), obwohl die erste Anfrage 30 verlangt:
  // Free — der Normalfall — sieht so nie einen springenden Umschalter; bei
  // Pro stellt die Antwort (statsWindowDays) ihn einmal auf 30.
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [decksErr, setDecksErr] = useState(false);
  // Prüfungen: null = noch nicht geladen (Block bleibt weg), [] = geladen, keine.
  const [attempts, setAttempts] = useState<TestAttemptSummary[] | null>(null);
  // Deck-Vergleich ist Pro-only; der Server meldet das mit 403/PRO_REQUIRED.
  const [proLocked, setProLocked] = useState(false);
  // "unknown" = Tarif-Abfrage gescheitert; dann entscheidet beim Deck-Vergleich der Server.
  const [tier, setTier] = useState<"free" | "pro" | "lifetime" | "unknown" | null>(null);
  const [proHint, setProHint] = useState(false);
  const coarsePointer = useCoarsePointer();

  // Genau EINE Stats-Anfrage, deren Antwort auch den Umschalter stellt: Der
  // Server klemmt Free auf 7 Tage und meldet das gelieferte Fenster zurück
  // (statsWindowDays). Der Zähler lässt veraltete Antworten verfallen
  // (Wechsel während des Ladens).
  const statsRequestSeq = useRef(0);
  const loadStats = useCallback((days: 7 | 30) => {
    const seq = ++statsRequestSeq.current;
    setLoading(true);
    getStats(days)
      .then(({ stats }) => {
        if (seq !== statsRequestSeq.current) return;
        setStats(stats);
        setRangeDays((stats.statsWindowDays ?? days) === 30 ? 30 : 7);
      })
      .catch((e) => {
        if (seq === statsRequestSeq.current)
          setError(isApiError(e) ? e.message : "Statistik nicht verfügbar.");
      })
      .finally(() => {
        if (seq === statsRequestSeq.current) setLoading(false);
      });
  }, []);

  // Beim Öffnen das größtmögliche Fenster anfragen — Pro bekommt 30, Free
  // bekommt geklemmte 7 und der Umschalter zeigt es ehrlich.
  useEffect(() => {
    loadStats(30);
    return () => {
      statsRequestSeq.current++; // in-flight Antworten nach dem Verlassen verfallen
    };
  }, [loadStats]);

  // Der Tarif steuert nur noch Schloss + Hinweis am 30-Tage-Knopf. Welches
  // Fenster die Daten haben, sagt die Stats-Antwort selbst — früher setzte
  // „free" hier rangeDays auf 7 und löste damit eine zweite, identische
  // Stats-Anfrage aus (#492).
  useEffect(() => {
    let active = true;
    getLpBalance()
      .then((u) => {
        if (active) setTier(u.tier);
      })
      .catch(() => {
        if (active) setTier("unknown");
      });
    return () => {
      active = false;
    };
  }, []);

  // Deck-Vergleich ist Pro-only: erst die Tarif-Antwort abwarten und als Free
  // gar nicht anfragen — der sichere 403 stand sonst als Fehler in der
  // Konsole (#499). Nur bei unbekanntem Tarif entscheidet weiter der Server.
  useEffect(() => {
    if (tier === null) return;
    if (tier === "free") {
      setProLocked(true);
      return;
    }
    let active = true;
    getDeckSummaries()
      .then(({ decks }) => active && setDecks(decks))
      .catch((e) => {
        if (!active) return;
        if (isApiError(e) && (e.code === "PRO_REQUIRED" || e.status === 403)) setProLocked(true);
        else setDecksErr(true);
      });
    return () => {
      active = false;
    };
  }, [tier]);

  useEffect(() => {
    let active = true;
    // Fenster-unabhängig (immer die letzten Prüfungen), daher eigener Effekt.
    // Schlägt es fehl, bleibt attempts null und der Block einfach weg — kein
    // Fehlerkasten für ein Nebenpanel.
    getTestAttempts()
      .then(({ attempts }) => active && setAttempts(attempts))
      .catch(() => {
        /* Prüfungs-Block ist optional; bei Fehler nicht anzeigen */
      });
    return () => {
      active = false;
    };
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
  // Der Ring zeigt das gewählte Fenster, also entscheidet auch das Fenster, ob
  // es überhaupt etwas zu zeigen gibt: sonst behauptet er "0 %" für jemanden,
  // der in diesen Tagen schlicht nichts gelernt hat. Rückfall auf die
  // Gesamtzahl nur für ältere APIs, die das Feld noch nicht senden.
  const windowCount = stats?.reviewsInWindow ?? stats?.reviewsTotal ?? 0;
  const hasWindowReviews = windowCount > 0;
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

  // Für Free ist das 30-Tage-Fenster Pro: Knopf zeigt ein Schloss, der Klick
  // erklärt das ehrlich, statt heimlich 7-Tage-Daten als 30 auszugeben.
  const seg = (days: 7 | 30, label: string) => {
    const locked = days === 30 && tier === "free";
    const active = rangeDays === days;
    return (
      <button
        type="button"
        onClick={() => {
          if (locked) {
            setProHint(true);
            return;
          }
          setProHint(false);
          if (active) return; // schon gewählt — nichts neu laden
          setRangeDays(days); // sofort fürs Auge; die Antwort bestätigt das Fenster
          loadStats(days);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 14px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: 600,
          background: active ? "var(--brand)" : "transparent",
          color: active ? "#fff" : "var(--ink-3)",
        }}
      >
        {label}
        {locked && <Lock size={12} />}
      </button>
    );
  };

  const ctxRow = (label: string, value: ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
      <span className="muted">{label}</span>
      <b style={{ color: "var(--ink)" }}>{value}</b>
    </div>
  );

  return (
    // minmax(0, 1fr): Sonst richtet sich die Spalte nach dem sperrigsten Kind —
    // abgeschnittene Deck-Titel melden trotz overflow:hidden ihre volle Breite.
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
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

      {proHint && (
        <p className="muted" style={{ fontSize: "0.85rem", margin: "-6px 0 0", textAlign: "right" }}>
          Den 30-Tage-Rückblick gibt es mit Pro — freischalten in der clearn-App.
        </p>
      )}

      {/* KPI-Reihe */}
      <div className="st-kpi">
        <div className="st-kpi-tile">
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Trefferquote
          </span>
          <b>{hasWindowReviews ? `${accPct} %` : "—"}</b>
          {/* Zähler und Nenner müssen aus demselben Zeitraum stammen: hier stand
              die Quote der letzten 30 Tage über der Zahl ALLER Antworten seit
              jeher — zwei Zeiträume in einer Kachel. */}
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            {windowCount.toLocaleString("de-DE")} Antworten · {rangeDays} Tage
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

      {/* Aufgeschlüsselt: die Kachel oben mischt Abrufen und Wiedererkennen.
          Nur zeigen, wenn die API das Feld liefert — ältere Stände sollen keine
          leere Karte hinterlassen. */}
      {stats?.accuracyByKind && <AccuracyByKindPanel data={stats.accuracyByKind} />}

      {/* Prüfungs-Bereich — direkt unter „Trefferquote genauer". Erst zeigen,
          wenn geladen (attempts !== null): sonst blitzte der Leerzustand kurz
          auf, bevor die Prüfungen da sind. Die selbst vergebene Vergleichszahl
          ist die „Aus dem Kopf gewusst"-Quote. */}
      {attempts !== null && (
        <TestAttemptsPanel
          attempts={attempts}
          selfGradedRate={stats?.accuracyByKind?.recall.rate ?? null}
        />
      )}

      {/* Hero: Trefferquote-Verlauf, volle Breite */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h3 className="h3" style={{ margin: 0 }}>
            Trefferquote-Verlauf
          </h3>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            letzte {rangeDays} Tage
            {learningDays >= 2 && " · Punkt drüberfahren für Details"}
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
                {coarsePointer ? "für Details antippen" : "für Details drüberfahren"}
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
          <AccuracyRing accuracy={accRate} hasData={hasWindowReviews} size={128} />
          <div className="muted" style={{ fontSize: "0.78rem", textAlign: "center" }}>
            {hasWindowReviews
              ? `richtig beantwortet bei ${windowCount.toLocaleString("de-DE")} Antworten in den letzten ${rangeDays} Tagen`
              : `keine Antworten in den letzten ${rangeDays} Tagen`}
          </div>
          <div style={{ alignSelf: "stretch", display: "grid", gap: 8, marginTop: 2 }}>
            {ctxRow("Bester Streak", `${stats?.longestStreak ?? 0} Tage`)}
            {ctxRow("Decks", stats?.totalDecks ?? 0)}
            {ctxRow("Jetzt fällig", stats?.dueCards ?? 0)}
            {ctxRow("Tagesziel", `${stats?.reviewsToday ?? 0} / ${goal || "—"}`)}
          </div>
        </div>
      </div>

      {/* Deck-Vergleich — Pro-only; Free sieht einen gesperrten Teaser */}
      <div className="panel">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <span className="h3">Deck-Vergleich</span>
            {proLocked ? (
              <span
                style={{
                  marginLeft: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "rgba(99, 102, 241, 0.12)",
                  color: "var(--brand)",
                  borderRadius: 999,
                  padding: "2px 9px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  verticalAlign: 2,
                }}
              >
                <Lock size={11} /> Pro
              </span>
            ) : (
              <span className="muted" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
                schwächstes zuerst
              </span>
            )}
          </div>
          {!proLocked && sortedDecks && sortedDecks.length > 0 && (
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              {coarsePointer ? "für Details antippen" : "für Details anklicken"}
            </span>
          )}
        </div>
        {proLocked ? (
          <div style={{ display: "grid", gap: 8 }}>
            {[85, 70, 55].map((w) => (
              <div
                key={w}
                style={{ height: 10, borderRadius: 5, background: "var(--bg-soft)", width: `${w}%` }}
                aria-hidden
              />
            ))}
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>
              Sieh pro Deck, wo du am schwächsten bist — den Deck-Vergleich gibt es mit Pro in der
              clearn-App.
            </p>
          </div>
        ) : sortedDecks === null ? (
          decksErr ? (
            <p className="muted">Der Deck-Vergleich konnte nicht geladen werden.</p>
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
