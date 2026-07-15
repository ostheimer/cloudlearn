"use client";

// Wiederverwendbare Statistik-Diagramme im App-Stil (portiert von
// apps/mobile/src/components/statsCharts.tsx). Reines Inline-SVG, theme-aware
// über CSS-Tokens, responsiv per viewBox (width:100%).

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

/** Genauigkeits-Ring mit zentriertem Prozentwert. accuracy ist 0..1. */
export function AccuracyRing({
  accuracy,
  hasData,
  size = 104,
}: {
  accuracy: number;
  hasData: boolean;
  size?: number;
}) {
  const stroke = 10;
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

/** Genauigkeits-Trendlinie: Prozent-Gitter, Punkte + Linie, Datum unten. */
export function AccuracyTrendChart({
  data,
  showAllDates,
}: {
  data: Array<{ date: string; accuracy: number; count: number }>;
  showAllDates: boolean;
}) {
  const W = 340;
  const H = 170;
  const PAD_L = 34;
  const PAD_R = 10;
  const PAD_T = 12;
  const PAD_B = 22;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = data.length;
  const xFor = (i: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW);
  const yFor = (acc: number) => PAD_T + (1 - Math.max(0, Math.min(1, acc))) * plotH;

  const pts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.accuracy).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD_L}
            y1={PAD_T + (1 - f) * plotH}
            x2={W - PAD_R}
            y2={PAD_T + (1 - f) * plotH}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {(f === 0 || f === 0.5 || f === 1) && (
            <text
              x={PAD_L - 6}
              y={PAD_T + (1 - f) * plotH}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={9}
              fill="var(--ink-4)"
            >
              {Math.round(f * 100)}%
            </text>
          )}
        </g>
      ))}
      <polyline
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
      {data.map((d, i) => (
        <circle key={i} cx={xFor(i)} cy={yFor(d.accuracy)} r={3.5} fill="var(--brand)">
          <title>{`${shortDate(d.date)}: ${Math.round(d.accuracy * 100)}%`}</title>
        </circle>
      ))}
      {showAllDates
        ? data.map((d, i) => (
            <text
              key={`x${i}`}
              x={xFor(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              fill="var(--ink-4)"
            >
              {shortDay(d.date)}
            </text>
          ))
        : n > 0 && (
            <>
              <text x={PAD_L} y={H - 6} textAnchor="start" fontSize={9} fill="var(--ink-4)">
                {shortDate(data[0]?.date ?? "")}
              </text>
              <text x={W - PAD_R} y={H - 6} textAnchor="end" fontSize={9} fill="var(--ink-4)">
                {shortDate(data[n - 1]?.date ?? "")}
              </text>
            </>
          )}
    </svg>
  );
}

/** Balken-Diagramm „Karten pro Tag" mit Datums-Beschriftung. */
export function ActivityBars({
  data,
  showAllDates,
}: {
  data: Array<{ date: string; count: number }>;
  showAllDates: boolean;
}) {
  const W = 340;
  const H = 150;
  const PAD_L = 30;
  const PAD_R = 8;
  const PAD_T = 16;
  const PAD_B = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = data.length;
  const slot = n > 0 ? plotW / n : plotW;
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const dense = !showAllDates; // 30-Tage-Sicht → dünne Balken, keine Wertlabels
  const barW = dense ? Math.max(2, slot - 3) : Math.max(2, Math.min(slot * 0.6, 26));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      <text x={PAD_L} y={11} textAnchor="start" fontSize={9} fill="var(--ink-4)">
        {`max ${maxCount} ${maxCount === 1 ? "Karte" : "Karten"}`}
      </text>
      {data.map((d, i) => {
        const bh = (d.count / maxCount) * plotH;
        const drawH = d.count > 0 ? Math.max(bh, 2) : 0;
        const x = PAD_L + i * slot + (slot - barW) / 2;
        const y = PAD_T + plotH - drawH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={drawH} rx={2} fill="var(--brand)">
              <title>{`${shortDate(d.date)}: ${d.count}`}</title>
            </rect>
            {!dense && d.count > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
                {d.count}
              </text>
            )}
          </g>
        );
      })}
      {data.map((d, i) => {
        const show = dense ? i % 5 === 0 : true;
        if (!show) return null;
        return (
          <text
            key={`x${i}`}
            x={PAD_L + i * slot + slot / 2}
            y={H - 5}
            textAnchor="middle"
            fontSize={9}
            fill="var(--ink-4)"
          >
            {shortDay(d.date)}
          </text>
        );
      })}
    </svg>
  );
}
