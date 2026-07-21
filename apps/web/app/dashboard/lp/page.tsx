"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLpBalance, isApiError, type AiUsageResponse } from "@/lib/api";
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  Play,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "@/components/icons";

// Dieselben vier Pakete wie im App-Shop (apps/mobile/src/features/paywall/lpPackOffers.ts).
// Die Preise liefert dort der App-Store; im Browser gibt es noch keinen Kauf,
// deshalb zeigen wir nur, welche Pakete es gibt — ohne einen Preis zu erfinden.
const LP_PACKS = [
  { lp: 100, popular: false },
  { lp: 300, popular: true },
  { lp: 750, popular: false },
  { lp: 2000, popular: false },
] as const;

// Einmalige Meilenstein-Boni (packages/contracts/src/featureGates.ts).
// Der Server kann Meilensteine nur einlösen, nicht abfragen — es gibt also
// keinen Weg herauszufinden, welche davon schon erreicht sind. Darum stehen
// sie hier als Übersicht ohne Haken.
const MILESTONES = [
  { label: "Erstes Deck", lp: 10 },
  { label: "Erste Lernsitzung", lp: 5 },
  { label: "7 Tage", lp: 25 },
  { label: "30 Tage", lp: 100 },
  { label: "100 Tage", lp: 300 },
] as const;

export default function LpPage() {
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLpBalance()
      .then((u) => {
        if (active) setUsage(u);
      })
      .catch((e) => {
        if (active) setError(isApiError(e) ? e.message : "Lernpunkte-Stand nicht verfügbar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="spinner" />;

  if (error || !usage) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Zap size={30} />
        </div>
        <h3>Lernpunkte nicht verfügbar</h3>
        <p>{error ?? "Bitte lade die Seite neu."}</p>
        <Link href="/dashboard" className="btn btn-primary">
          Zur Bibliothek
        </Link>
      </div>
    );
  }

  const isFree = usage.tier === "free";
  const earnPct =
    usage.lpEarnCapToday > 0
      ? Math.min(100, Math.round((usage.lpEarnedToday / usage.lpEarnCapToday) * 100))
      : 0;
  const adPct =
    usage.lpAdCapToday > 0
      ? Math.min(100, Math.round((usage.lpAdsToday / usage.lpAdCapToday) * 100))
      : 0;

  return (
    <>
      <Link href="/dashboard" className="crumb">
        <ArrowLeft size={16} /> Bibliothek
      </Link>

      <div className="lib-head">
        <div>
          <h1>Lernpunkte</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Womit du neue Karten erstellst — und wie du sie verdienst.
          </p>
        </div>
      </div>

      <div className="lp-page">
        {/* Guthaben + was heute noch drin ist */}
        <div className="lp-top">
          <div className="lp-balance">
            <span className="lp-balance__num">
              <Zap size={30} style={{ color: "#fff" }} />
              <b>{usage.lpBalance.toLocaleString("de-DE")}</b>
            </span>
            <div className="lp-balance__cap">Verfügbare Lernpunkte</div>
          </div>

          <div className="panel">
            <div
              style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, marginBottom: 14 }}
            >
              <TrendingUp size={18} style={{ color: "var(--green)" }} /> Was du heute noch verdienen
              kannst
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9rem",
                marginBottom: 6,
              }}
            >
              <span className="muted">Durch Lernen</span>
              <span style={{ fontWeight: 700 }}>
                {usage.lpEarnedToday} / {usage.lpEarnCapToday} LP
              </span>
            </div>
            <div className="lp-track">
              <i style={{ width: `${earnPct}%` }} />
            </div>

            {isFree && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.9rem",
                    margin: "14px 0 6px",
                  }}
                >
                  <span className="muted">Durch Werbung</span>
                  <span style={{ fontWeight: 700 }}>
                    {usage.lpAdsToday} / {usage.lpAdCapToday} LP
                  </span>
                </div>
                <div className="lp-track">
                  <i style={{ width: `${adPct}%`, background: "var(--amber)" }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Die Wege zu neuen Lernpunkten */}
        <h2 className="lp-sec">So bekommst du Lernpunkte</h2>
        <div className="lp-ways">
          <Link href="/dashboard" className="lp-way">
            <div className="lp-way__row">
              <span className="lp-way__ic" style={{ background: "rgba(16,185,129,0.12)" }}>
                <Play size={20} style={{ color: "var(--green)" }} />
              </span>
              <span className="lp-way__txt">
                <span className="lp-way__t">Lernen</span>
                <span className="lp-way__s">
                  Ab 5 Karten +5 LP, bis {usage.lpEarnCapToday} LP am Tag
                </span>
              </span>
              <ChevronRight size={18} style={{ color: "var(--ink-3)", flex: "none" }} />
            </div>
          </Link>

          <Link href="/dashboard/friends/add" className="lp-way">
            <div className="lp-way__row">
              <span className="lp-way__ic" style={{ background: "var(--amber-50)" }}>
                <Users size={20} style={{ color: "var(--amber)" }} />
              </span>
              <span className="lp-way__txt">
                <span className="lp-way__t">Freunde einladen</span>
                <span className="lp-way__s">
                  +50 LP je geworbenem Freund, +25 LP fürs Einlösen eines Codes
                </span>
              </span>
              <ChevronRight size={18} style={{ color: "var(--ink-3)", flex: "none" }} />
            </div>
          </Link>

          <div className="lp-way">
            <div className="lp-way__row">
              <span className="lp-way__ic" style={{ background: "var(--brand-50)" }}>
                <Flame size={20} style={{ color: "var(--brand)" }} />
              </span>
              <span className="lp-way__txt">
                <span className="lp-way__t">Meilensteine</span>
                <span className="lp-way__s">Einmalige Boni, sobald du sie erreichst</span>
              </span>
            </div>
            <div className="lp-ms">
              {MILESTONES.map((m) => (
                <span key={m.label}>
                  {m.label} +{m.lp}
                </span>
              ))}
            </div>
          </div>

          {isFree && (
            <div className="lp-way">
              <div className="lp-way__row">
                <span className="lp-way__ic" style={{ background: "var(--bg-softer)" }}>
                  <Smartphone size={20} style={{ color: "var(--ink-3)" }} />
                </span>
                <span className="lp-way__txt">
                  <span className="lp-way__t">
                    Werbung ansehen<span className="lp-tag">nur in der App</span>
                  </span>
                  <span className="lp-way__s">
                    +5 LP pro Video, bis {usage.lpAdCapToday} LP am Tag
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pakete: im Browser noch nicht kaufbar, aber sichtbar */}
        <h2 className="lp-sec">
          <Zap size={17} style={{ color: "var(--amber)" }} /> Lernpunkte-Pakete
          <span className="lp-sec__hint">Kauf im Browser kommt noch — in der App geht es schon</span>
        </h2>
        <div className="lp-packs">
          {LP_PACKS.map((pack) => (
            <div key={pack.lp} className={pack.popular ? "lp-pack is-best" : "lp-pack"}>
              {pack.popular ? (
                <span className="lp-pack__badge">Bester Wert</span>
              ) : (
                <Zap size={18} style={{ color: "var(--amber)" }} />
              )}
              <div className="lp-pack__lp">{pack.lp.toLocaleString("de-DE")} LP</div>
              <div className="lp-pack__hint">
                {Math.floor(pack.lp / usage.lpCostAiScan)} Foto-Scans
              </div>
              <div className="lp-pack__where">In der App</div>
            </div>
          ))}
        </div>

        {/* Pro (nur für Free-Konten — wer Pro hat, braucht die Werbung nicht) */}
        {isFree && (
          <Link href="/dashboard/pro" className="lp-pro">
            <Star size={22} style={{ color: "var(--amber)", flex: "none" }} />
            <span className="lp-way__txt">
              <span className="lp-way__t">Mehr mit Pro</span>
              <span className="lp-way__s">
                300 LP pro Monat inklusive · günstigere LP-Kosten · PDF-Import · und mehr
              </span>
            </span>
            <span className="lp-pro__go">
              Alles ansehen <ChevronRight size={16} />
            </span>
          </Link>
        )}
      </div>
    </>
  );
}
