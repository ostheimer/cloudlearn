import { useState, type ReactNode } from "react";
import { Dimensions, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { useColors, spacing, typography } from "../theme";

// Gemeinsame Statistik-Bausteine (#246): Genauigkeits-Ring und Trendlinie
// werden vom Statistik-Tab und vom Deck-Statistik-Bildschirm geteilt.

export const CHART_HEIGHT = 180;

// ─── Accuracy ring geometry ──────────────────────────────────────────────
const RING_R = 40;
const RING_STROKE = 12;
const RING_SIZE = 2 * RING_R + RING_STROKE; // leave room for the stroke
const RING_C = 2 * Math.PI * RING_R; // circumference

// Horizontal chrome around the chart card contents:
// ScrollView padding (spacing.xl) on both sides + card padding (spacing.lg) on both sides.
const FALLBACK_CHART_WIDTH =
  Dimensions.get("window").width - 2 * spacing.xl - 2 * spacing.lg;

/** "07.07." aus einem ISO-Datum (YYYY-MM-DD). */
export function shortDate(iso: string): string {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}.${parts[1]}.`;
}

/** "07." aus einem ISO-Datum — für die dichte Alle-Tage-Beschriftung. */
export function shortDay(iso: string): string {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}.`;
}

/**
 * Measures its own available width via onLayout and hands it to `render`,
 * so charts fill the card. Falls back to a window-derived width before the
 * first layout pass.
 */
export function ResponsiveChart({
  render,
}: {
  render: (width: number) => ReactNode;
}) {
  const [measured, setMeasured] = useState(0);
  const width = measured > 0 ? measured : FALLBACK_CHART_WIDTH;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measured) > 0.5) {
      setMeasured(w);
    }
  };

  return <View onLayout={onLayout}>{render(width)}</View>;
}

/**
 * Genauigkeits-Ring mit zentriertem Prozentwert. `accuracy` ist 0..1;
 * ohne Daten (hasData=false) bleibt der Ring leer und zeigt "—".
 */
export function AccuracyRing({
  accuracy,
  hasData,
}: {
  accuracy: number;
  hasData: boolean;
}) {
  const colors = useColors();
  const accClamped = Math.max(0, Math.min(1, accuracy));
  const dash = accClamped * RING_C;
  const c = RING_SIZE / 2; // center x/y

  return (
    <View
      style={{
        width: RING_SIZE,
        height: RING_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Background track */}
        <Circle
          cx={c}
          cy={c}
          r={RING_R}
          stroke={colors.border}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {/* Foreground progress arc (starts at top, clockwise) */}
        {hasData ? (
          <Circle
            cx={c}
            cy={c}
            r={RING_R}
            stroke={colors.primary}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash.toFixed(2)} ${RING_C.toFixed(2)}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
      </Svg>
      {/* Centered percentage label */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: typography.extrabold,
            color: colors.text,
          }}
        >
          {hasData ? `${Math.round(accClamped * 100)}%` : "—"}
        </Text>
      </View>
    </View>
  );
}

/**
 * Genauigkeits-Trendlinie: gestrichelte Prozent-Gitterlinien (0/25/50/75/100),
 * Punkte pro Lern-Tag, Datumsbeschriftung unten. `showAllDates` (7-Tage-Sicht)
 * beschriftet JEDEN Punkt mit seinem Tag ("07.", "08.", …); sonst nur den
 * ersten und letzten Tag ("07.07.").
 */
export function AccuracyTrendChart({
  data,
  showAllDates,
}: {
  data: Array<{ date: string; accuracy: number; count: number }>;
  showAllDates: boolean;
}) {
  const colors = useColors();

  const renderChart = (width: number) => {
    const PAD_L = 34;
    const PAD_R = 10;
    const PAD_T = 14;
    const PAD_B = 22;
    const plotW = Math.max(width - PAD_L - PAD_R, 10);
    const plotH = Math.max(CHART_HEIGHT - PAD_T - PAD_B, 10);
    const n = data.length;
    const lastIdx = n - 1;
    const dense = n > 10;

    const xAt = (i: number) =>
      n <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW;
    const yAt = (acc: number) => {
      const clamped = Math.max(0, Math.min(1, acc));
      return PAD_T + (1 - clamped) * plotH;
    };

    const gridLevels = [0, 0.25, 0.5, 0.75, 1];
    const points = data
      .map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.accuracy).toFixed(1)}`)
      .join(" ");

    return (
      <Svg width={width} height={CHART_HEIGHT}>
        {/* Gridlines */}
        {gridLevels.map((f) => {
          const y = PAD_T + (1 - f) * plotH;
          return (
            <Line
              key={`grid-${f}`}
              x1={PAD_L}
              y1={y}
              x2={PAD_L + plotW}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          );
        })}
        {/* Y-axis labels */}
        {gridLevels.map((f) => {
          const y = PAD_T + (1 - f) * plotH;
          return (
            <SvgText
              key={`ylabel-${f}`}
              x={PAD_L - 6}
              y={y + 3}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="end"
            >
              {`${Math.round(f * 100)}%`}
            </SvgText>
          );
        })}
        {/* Accuracy line */}
        <Polyline
          points={points}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Points (last one emphasized, smaller when dense) */}
        {data.map((d, i) => {
          const isLast = i === lastIdx;
          return (
            <Circle
              key={`pt-${i}`}
              cx={xAt(i)}
              cy={yAt(d.accuracy)}
              r={isLast ? (dense ? 4 : 5) : dense ? 2 : 3}
              fill={isLast ? colors.primary : colors.surface}
              stroke={colors.primary}
              strokeWidth={isLast ? 2 : 1.5}
            />
          );
        })}
        {/* Date labels: every point (7-day view) or first + last */}
        {showAllDates ? (
          data.map((d, i) => (
            <SvgText
              key={`xlabel-${i}`}
              x={xAt(i)}
              y={CHART_HEIGHT - 6}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="middle"
            >
              {shortDay(d.date)}
            </SvgText>
          ))
        ) : (
          <>
            <SvgText
              x={xAt(0)}
              y={CHART_HEIGHT - 6}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="start"
            >
              {shortDate(data[0]?.date ?? "")}
            </SvgText>
            {n > 1 ? (
              <SvgText
                x={xAt(lastIdx)}
                y={CHART_HEIGHT - 6}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {shortDate(data[lastIdx]?.date ?? "")}
              </SvgText>
            ) : null}
          </>
        )}
      </Svg>
    );
  };

  return <ResponsiveChart render={renderChart} />;
}
