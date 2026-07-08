"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLpBalance, isApiError, type AiUsageResponse } from "@/lib/api";
import { ArrowLeft, Zap, Target, Play, Smartphone } from "@/components/icons";

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

  const earnPct =
    usage.lpEarnCapToday > 0
      ? Math.min(100, Math.round((usage.lpEarnedToday / usage.lpEarnCapToday) * 100))
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
            Womit du Karten per KI erstellst — und wie du sie verdienst.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 620 }}>
        {/* Guthaben-Karte (Amber, wie im App-Shop) */}
        <div className="lp-balance">
          <span className="lp-balance__num">
            <Zap size={30} style={{ color: "#fff" }} />
            <b>{usage.lpBalance.toLocaleString("de-DE")}</b>
          </span>
          <div className="lp-balance__cap">Verfügbare Lernpunkte</div>
        </div>

        {/* Täglicher Fortschritt (Durch Lernen) */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            <Target size={18} style={{ color: "var(--green)" }} /> Täglicher Fortschritt
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
        </div>

        {/* So verdienst du LP + CTA */}
        <div className="lp-warn" style={{ marginBottom: 12 }}>
          <Zap size={16} />
          <span>
            Neue Lernpunkte bekommst du <strong>durchs Lernen</strong>: Wähle ein Deck und starte
            eine Lernsitzung (ab 5 Karten +5 LP, bis {usage.lpEarnCapToday} LP am Tag).
          </span>
        </div>
        <Link href="/dashboard" className="btn btn-primary btn-block">
          <Play size={18} /> Deck wählen und lernen
        </Link>

        {/* Kosten pro Aktion */}
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink-2)", margin: "22px 0 8px" }}>
          Was kostet ein KI-Import?
        </div>
        <div className="lp-costs">
          <div className="lp-cost">
            <b>{usage.lpCostAiScan}</b>
            <span>Foto · Text</span>
          </div>
          <div className="lp-cost">
            <b>{usage.lpCostUrlImport}</b>
            <span>URL</span>
          </div>
          <div className="lp-cost">
            <b>{usage.lpCostPdfImport}</b>
            <span>PDF</span>
          </div>
        </div>

        {/* Ehrlicher Hinweis: Pakete/Werbung nur in der App */}
        <div className="info-note" style={{ marginTop: 16 }}>
          <Smartphone size={16} />
          <span>
            Lernpunkte-Pakete kaufen und Werbung zum Verdienen gibt es in der clearn-App — im
            Browser nicht.
          </span>
        </div>
      </div>
    </>
  );
}
