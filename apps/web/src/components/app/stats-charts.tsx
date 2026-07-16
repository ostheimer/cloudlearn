"use client";

import { useEffect, useRef, useState } from "react";

// Wiederverwendbare Statistik-Diagramme im App-Stil (portiert von
// apps/mobile/src/components/statsCharts.tsx). Reines Inline-SVG, theme-aware.
// Verlauf + Balken MESSEN ihre echte Breite (ResizeObserver) und füllen die
// Karte randlos — kein festes kleines viewBox mit Weißraum links/rechts.

/** "07.07." aus einem ISO-Datum. */
export function shortDate(iso: string): string {
  if (!iso || typeof iso !== "string") return "";
  const p = iso.split("-");
  if (p.length < 3) return iso;
  return `${p[2]}.${p[1]}.`;
}

/** "07." aus einem ISO-Datum — für die dichte Alle-Tage-Beschriftung. */
export function shortDay(iso: string): string {
  if (!iso || typeof iso !== "string") return "";
  const p = iso.split("-");
  if (p.length < 3) return iso;
  return `${p[2]}.`;
}

const SHORT_WEEKDAYS = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."] as const;
/** "Fr. 10.07." — Wochentag (an UTC-Mittag, zeitzonensicher) + Datum. */
function dayTitle(iso: string): string {
  const d = shortDate(iso);
  const nums = iso.split("-").map(Number);
  if (nums.length < 3 || nums.some((x) => Number.isNaN(x))) return d;
  const [y, m, day] = nums;
  const wd = SHORT_WEEKDAYS[new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, day ?? 1, 12)).getUTCDay()] ?? "";
  return `${wd} ${d}`;
}

/** Kleine Detail-Sprechblase am angetippten Punkt/Balken (x horizontal geklemmt). */
function ChartCallout({
  x,
  y,
  W,
  padL,
  padR,
  line1,
  line2,
}: {
  x: number;
  y: number;
  W: number;
  padL: number;
  padR: number;
  line1: string;
  line2: string;
}) {
  const cw = 134;
  const ch = 44;
  let bx = x - cw / 2;
  bx = Math.max(padL, Math.min(bx, W - padR - cw));
  let by = y - ch - 12;
  if (by < 2) by = y + 14;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={bx} y={by} width={cw} height={ch} rx={8} fill="var(--surface)" stroke="var(--line)" strokeWidth={1} />
      <text x={bx + cw / 2} y={by + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">
        {line1}
      </text>
      <text x={bx + cw / 2} y={by + 34} textAnchor="middle" fontSize={12} fill="var(--ink-3)">
        {line2}
      </text>
    </g>
  );
}

/** Misst die tatsächliche Breite des Containers (Chart füllt die Karte). */
function useMeasuredWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(600); // Startwert gegen Layout-Sprung vor dem Messen
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Genauigkeits-Ring mit zentriertem Prozentwert. accuracy ist 0..1. */
export function AccuracyRing({
  accuracy,
  hasData,
  size = 120,
}: {
  accuracy: number;
  hasData: boolean;
  size?: number;
}) {
  const stroke = 12;
  const r = size / 2 - stroke;
  const c = size / 2;
  const C = 2 * Math.PI * r;
  const acc = Math.max(0, Math.min(1, accuracy));
  const dash = acc * C;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {hasData && (
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(2)} ${C.toFixed(2)}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      )}
      <text
        x={c}
        y={c}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.24}
        fontWeight={800}
        fill="var(--ink)"
      >
        {hasData ? `${Math.round(acc * 100)}%` : "—"}
      </text>
    </svg>
  );
}

/** Genauigkeits-Trendlinie mit Fläche, %-Gitter, Punkten, Datum unten. */
export function AccuracyTrendChart({
  data,
  showAllDates,
  height = 220,
}: {
  data: Array<{ date: string; accuracy: number; count: number }>;
  showAllDates: boolean;
  height?: number;
}) {
  const [ref, W] = useMeasuredWidth();
  const [sel, setSel] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  // Maus drüberfahren zeigt sofort; ein Klick „pinnt" die Sprechblase fest.
  const active = hov ?? sel;
  useEffect(() => {
    setSel(null);
    setHov(null);
  }, [data]);
  const H = height;
  const PAD_L = 38;
  const PAD_R = 14;
  const PAD_T = 16;
  const PAD_B = 26;
  const plotW = Math.max(W - PAD_L - PAD_R, 10);
  const plotH = H - PAD_T - PAD_B;
  const n = data.length;
  const xFor = (i: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW);
  const yFor = (acc: number) => PAD_T + (1 - Math.max(0, Math.min(1, acc))) * plotH;
  const line = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.accuracy).toFixed(1)}`).join(" ");
  const area =
    n > 0
      ? `${PAD_L},${(PAD_T + plotH).toFixed(1)} ${line} ${(PAD_L + plotW).toFixed(1)},${(
          PAD_T + plotH
        ).toFixed(1)}`
      : "";
  const last = n > 0 ? data[n - 1] : null;

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD_L}
              y1={PAD_T + (1 - f) * plotH}
              x2={W - PAD_R}
              y2={PAD_T + (1 - f) * plotH}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray="3 5"
            />
            {(f === 0 || f === 0.5 || f === 1) && (
              <text
                x={PAD_L - 8}
                y={PAD_T + (1 - f) * plotH}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={11}
                fill="var(--ink-4)"
              >
                {Math.round(f * 100)}%
              </text>
            )}
          </g>
        ))}
        {n > 1 && <polygon points={area} fill="url(#trendfill)" />}
        <polyline
          fill="none"
          stroke="var(--brand)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(d.accuracy)}
            r={active === i ? 6.5 : 4.5}
            fill={active === i ? "var(--brand-600)" : "var(--brand)"}
          />
        ))}
        {/* Unsichtbare, größere Ziele je Punkt: Hover zeigt, Klick pinnt fest */}
        {data.map((d, i) => (
          <circle
            key={`hit${i}`}
            cx={xFor(i)}
            cy={yFor(d.accuracy)}
            r={14}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
            onClick={() => setSel(sel === i ? null : i)}
          />
        ))}
        {last && (
          <text
            x={xFor(n - 1)}
            y={yFor(last.accuracy) - 10}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            fill="var(--brand)"
          >
            {Math.round(last.accuracy * 100)}%
          </text>
        )}
        {showAllDates
          ? data.map((d, i) => (
              <text
                key={`x${i}`}
                x={xFor(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ink-4)"
              >
                {shortDay(d.date)}
              </text>
            ))
          : n > 0 && (
              <>
                <text x={PAD_L} y={H - 8} textAnchor="start" fontSize={11} fill="var(--ink-4)">
                  {shortDate(data[0]?.date ?? "")}
                </text>
                <text x={W - PAD_R} y={H - 8} textAnchor="end" fontSize={11} fill="var(--ink-4)">
                  {shortDate(data[n - 1]?.date ?? "")}
                </text>
              </>
            )}
        {active !== null && active < n && data[active] && (
          <ChartCallout
            x={xFor(active)}
            y={yFor(data[active]!.accuracy)}
            W={W}
            padL={PAD_L}
            padR={PAD_R}
            line1={dayTitle(data[active]!.date)}
            line2={`${Math.round(data[active]!.accuracy * 100)}% richtig`}
          />
        )}
      </svg>
    </div>
  );
}

/** Balken-Diagramm „Karten pro Tag" (füllt die Breite) mit Datums-Beschriftung. */
export function ActivityBars({
  data,
  showAllDates,
  height = 200,
}: {
  data: Array<{ date: string; count: number }>;
  showAllDates: boolean;
  height?: number;
}) {
  const [ref, W] = useMeasuredWidth();
  const [sel, setSel] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  // Maus drüberfahren zeigt sofort; ein Klick „pinnt" die Sprechblase fest.
  const active = hov ?? sel;
  useEffect(() => {
    setSel(null);
    setHov(null);
  }, [data]);
  const H = height;
  const PAD_L = 30;
  const PAD_R = 10;
  const PAD_T = 20;
  const PAD_B = 22;
  const plotW = Math.max(W - PAD_L - PAD_R, 10);
  const plotH = H - PAD_T - PAD_B;
  const n = data.length;
  const slot = n > 0 ? plotW / n : plotW;
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const dense = !showAllDates;
  const barW = dense ? Math.max(3, slot - 4) : Math.max(3, Math.min(slot * 0.62, 34));

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <text x={PAD_L} y={13} textAnchor="start" fontSize={11} fill="var(--ink-4)">
          {`max ${maxCount} ${maxCount === 1 ? "Karte" : "Karten"}`}
        </text>
        {data.map((d, i) => {
          const bh = (d.count / maxCount) * plotH;
          const drawH = d.count > 0 ? Math.max(bh, 2) : 0;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + plotH - drawH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={drawH}
                rx={2.5}
                fill={active === i ? "var(--brand-600)" : "var(--brand)"}
              />
              {!dense && d.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                  {d.count}
                </text>
              )}
            </g>
          );
        })}
        {/* Unsichtbare Ziele über die volle Slot-Höhe — jeder Tag reagiert auf
            Maus-Hover (zeigt sofort) und Klick/Tipp (pinnt fest). */}
        {data.map((d, i) => (
          <rect
            key={`hit${i}`}
            x={PAD_L + i * slot}
            y={PAD_T}
            width={slot}
            height={plotH}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
            onClick={() => setSel(sel === i ? null : i)}
          />
        ))}
        {data.map((d, i) => {
          const show = dense ? i % 5 === 0 : true;
          if (!show) return null;
          return (
            <text
              key={`x${i}`}
              x={PAD_L + i * slot + slot / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ink-4)"
            >
              {shortDay(d.date)}
            </text>
          );
        })}
        {active !== null && active < n && data[active] && (
          <ChartCallout
            x={PAD_L + active * slot + slot / 2}
            y={
              PAD_T +
              plotH -
              Math.max((data[active]!.count / maxCount) * plotH, data[active]!.count > 0 ? 2 : 0)
            }
            W={W}
            padL={PAD_L}
            padR={PAD_R}
            line1={dayTitle(data[active]!.date)}
            line2={`${data[active]!.count} ${data[active]!.count === 1 ? "Karte" : "Karten"}`}
          />
        )}
      </svg>
    </div>
  );
}
