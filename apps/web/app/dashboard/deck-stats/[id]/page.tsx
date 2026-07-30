"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDeckStats, isApiError, type DeckStats } from "@/lib/api";
import { ArrowLeft, Lock, RotateCw } from "@/components/icons";
import { AccuracyRing, AccuracyTrendChart } from "@/components/app/stats-charts";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { wobblySummary } from "@/lib/wobbly-summary";

export default function DeckStatsPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();

  // „Drüberfahren" gibt es am Handy nicht — dort tippt man den Punkt an.
  // Gleiche Regel wie auf der großen Statistik-Seite (#521).
  const coarsePointer = useCoarsePointer();
  const [rangeDays, setRangeDays] = useState<7 | 30>(30);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Die Deck-Statistik ist Pro-only; der Server meldet Free mit 403/PRO_REQUIRED.
  const [proLocked, setProLocked] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    let active = true;
    setLoading(true);
    getDeckStats(deckId, rangeDays)
      .then((s) => {
        if (active) setStats(s);
      })
      .catch((e) => {
        if (!active) return;
        if (isApiError(e) && (e.code === "PRO_REQUIRED" || e.status === 403)) setProLocked(true);
        else setError(isApiError(e) ? e.message : "Deck-Statistik nicht verfügbar.");
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

  if (proLocked) {
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
            <div>
              <h1 style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                Deck-Statistik
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "var(--brand)",
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  <Lock size={12} /> Pro
                </span>
              </h1>
              <p className="muted" style={{ marginTop: 4 }}>
                Trefferquote, Verlauf und Wackelkandidaten je Deck
              </p>
            </div>
          </div>
        </div>
        <div className="panel" style={{ maxWidth: 560 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {[85, 70, 55].map((w) => (
              <div
                key={w}
                style={{ height: 10, borderRadius: 5, background: "var(--bg-soft)", width: `${w}%` }}
                aria-hidden
              />
            ))}
          </div>
          <p className="muted" style={{ margin: "14px 0 0", fontSize: "0.9rem" }}>
            Sieh für jedes Deck, wie gut du triffst, wie sich deine Quote entwickelt und welche
            Karten am meisten wackeln — die Deck-Statistik gibt es mit Pro in der clearn-App.
          </p>
        </div>
      </>
    );
  }

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
  // Angezeigt werden weiter 5 Zeilen — geübt wird aber die volle Menge (#682).
  // `wobblyTotal` ist die echte Zahl der Karten mit mindestens einem Fehler,
  // die Übe-Menge kappt der Server bei 100. Fehlen die Felder (ältere API
  // während eines rollenden Deploys), gilt die Anzeige-Liste.
  const wobbly = stats?.wobblyCards ?? [];
  const wobblyTotal = stats?.wobblyTotal ?? wobbly.length;
  const { subtitle: wobblySubtitle, practiceLabel } = wobblySummary(
    wobbly.length,
    wobblyTotal,
    (stats?.wobblyPracticeCards ?? wobbly).length
  );

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
              {learningDays >= 2 &&
                (coarsePointer
                  ? " · Punkt antippen für Details"
                  : " · Punkt drüberfahren für Details")}
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
        <h3 className="h3" style={{ marginBottom: wobblySubtitle ? 2 : 12 }}>
          Deine Wackelkandidaten
        </h3>
        {wobblySubtitle && (
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>
            {wobblySubtitle}
          </p>
        )}
        {wobbly.length > 0 ? (
          // minmax(0, 1fr): Kartentexte stehen auf nowrap und melden trotz
          // overflow:hidden ihre volle Breite — ohne die Klammer bläst eine
          // lange Karte die Spalte und damit die Seite am Handy auf.
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
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
                  {/* „N Fehler" statt „N× falsch" (Laras Wortlaut, #682): Das
                      Kreuz las sich wie eine Kartenzahl — 7 und 6 wurden als
                      13 Karten verstanden. Gezählt werden Fehler AUF DIESER
                      einen Karte. */}
                  {card.wrongCount} Fehler
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
        // `cards=wobbly` statt einer Liste aus bis zu 100 IDs: Die Lernseite
        // holt die Menge selbst (useWobblyIds) — sonst stünden mehrere Kilobyte
        // UUIDs in der Adresszeile, im Verlauf und in jedem Server-Log.
        <Link
          href={`/dashboard/deck/${deckId}/learn?cards=wobbly`}
          className="btn btn-primary btn-lg btn-block"
          style={{ textDecoration: "none", gap: 8 }}
        >
          <RotateCw size={18} /> {practiceLabel}
        </Link>
      )}
    </>
  );
}
