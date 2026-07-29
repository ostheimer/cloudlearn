"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLpBalance, type LpBalanceResponse } from "@/lib/api";
import {
  ArrowLeft,
  BarChart,
  BookOpen,
  CheckCircle,
  ImageIcon,
  Layers,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Zap,
} from "@/components/icons";

// Alle Zahlen stammen aus TIER_LIMITS (packages/contracts/src/featureGates.ts),
// free gegen pro. Sie stehen hier fest, weil das Web-Paket die Contracts nicht
// einbindet — ändern sich die Grenzen dort, muss diese Liste mitgehen.
const PRO_FEATURES = [
  {
    icon: Sparkles,
    title: "Günstigere KI-Kosten",
    text: "Scan 5 statt 10 LP, Link 8 statt 15, PDF 12 statt 20",
  },
  { icon: Zap, title: "300 LP jeden Monat", text: "Kommen automatisch aufs Konto" },
  { icon: TrendingUp, title: "Mehr pro Tag verdienen", text: "Bis 100 LP durchs Lernen statt 30" },
  { icon: Layers, title: "Mehr Platz", text: "500 Decks mit je 2.000 Karten statt 20 mit 150" },
  { icon: ShieldCheck, title: "Werbefrei", text: "Keine Werbung in der App" },
  { icon: ImageIcon, title: "Image Occlusion", text: "Teile eines Bildes abdecken und abfragen" },
  { icon: BarChart, title: "Erweiterte Statistik", text: "Deck-Vergleich und Verlauf" },
  { icon: BookOpen, title: "Offline lernen", text: "Decks in der App aufs Gerät laden" },
] as const;

export default function ProPage() {
  const [usage, setUsage] = useState<LpBalanceResponse | null>(null);

  useEffect(() => {
    let active = true;
    getLpBalance()
      .then((u) => {
        if (active) setUsage(u);
      })
      .catch(() => {
        /* Ohne Tarif-Info zeigen wir die Seite trotzdem — sie ist reine Information. */
      });
    return () => {
      active = false;
    };
  }, []);

  // Solange der Tarif unbekannt ist (laedt noch oder Abfrage-Fehler), behauptet
  // die Seite NICHTS: weder "Du hast Pro" noch die Kauf-Zeile. Vorher galt
  // unbekannt = Free, und ein Pro-Konto sah bei jedem Aussetzer die
  // Kauf-Aufforderung (#607).
  const tierKnown = usage !== null;
  const hasPro = tierKnown && usage.tier !== "free";
  const isFree = tierKnown && usage.tier === "free";

  return (
    <>
      <Link href="/dashboard/lp" className="crumb">
        <ArrowLeft size={16} /> Lernpunkte
      </Link>

      <div className="lib-head">
        <div>
          <h1>clearn Pro</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Was du mit Pro bekommst.
          </p>
        </div>
      </div>

      <div className="lp-page">
        {hasPro && (
          <div className="info-note" style={{ marginTop: 0, marginBottom: 18 }}>
            <CheckCircle size={16} />
            <span>Du hast Pro — alles hier ist für dich schon freigeschaltet.</span>
          </div>
        )}

        <div className="pro-grid">
          {PRO_FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="pro-feat">
              <Icon size={20} />
              <div>
                <div className="pro-feat__t">{title}</div>
                <div className="pro-feat__s">{text}</div>
              </div>
            </div>
          ))}
        </div>

        {isFree && (
          <div className="info-note" style={{ marginTop: 0 }}>
            <Smartphone size={16} />
            <span>
              Pro buchen geht derzeit nur in der clearn-App. Im Browser kommt es später dazu.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
