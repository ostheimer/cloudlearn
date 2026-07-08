import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { ArrowLeft, TrendingUp, Flame, CheckCircle2 } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { getStats, type StatsResponse } from "../src/lib/api";

const CHART_HEIGHT = 180;
const BAR_CHART_HEIGHT = 160;

// Horizontal chrome around the chart card contents:
// ScrollView padding (spacing.xl) on both sides + card padding (spacing.lg) on both sides.
const FALLBACK_CHART_WIDTH =
  Dimensions.get("window").width - 2 * spacing.xl - 2 * spacing.lg;

function shortDate(iso: string): string {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}.${parts[1]}.`;
}

/**
 * Measures its own available width via onLayout and hands it to `render`,
 * so charts fill the card. Falls back to a window-derived width before the
 * first layout pass.
 */
function ResponsiveChart({
  render,
}: {
  render: (width: number) => React.ReactNode;
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

export default function StatsScreen() {
  const router = useRouter();
  const colors = useColors();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStats()
      .then((res) => {
        if (!cancelled) setStats(res.stats);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Derived summary values ──────────────────────────────────────────────
  const accuracyRate = stats?.accuracyRate ?? 0;
  const reviewsTotal = stats?.reviewsTotal ?? 0;
  const streak = stats?.currentStreak ?? 0;
  const accuracyPercent = Math.round(accuracyRate * 100);
  const accuracyDisplay = reviewsTotal > 0 ? `${accuracyPercent}%` : "—";

  // ─── Chart data (guard undefined / sort ascending / last 14) ─────────────
  const accData = [...(stats?.accuracyByDay ?? [])]
    .filter(
      (d) =>
        d != null &&
        typeof d.date === "string" &&
        typeof d.accuracy === "number" &&
        !Number.isNaN(d.accuracy)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const barData = [...(stats?.reviewsByDay ?? [])]
    .filter(
      (d) =>
        d != null &&
        typeof d.date === "string" &&
        typeof d.count === "number" &&
        !Number.isNaN(d.count)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const hasAccuracyChart = accData.length >= 2;
  const hasBarChart = barData.some((d) => d.count > 0);

  // ─── Accuracy line chart renderer ────────────────────────────────────────
  const renderAccuracyChart = (width: number) => {
    const PAD_L = 34;
    const PAD_R = 10;
    const PAD_T = 14;
    const PAD_B = 22;
    const plotW = Math.max(width - PAD_L - PAD_R, 10);
    const plotH = Math.max(CHART_HEIGHT - PAD_T - PAD_B, 10);
    const n = accData.length;
    const lastIdx = n - 1;

    const xAt = (i: number) =>
      n <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW;
    const yAt = (acc: number) => {
      const clamped = Math.max(0, Math.min(1, acc));
      return PAD_T + (1 - clamped) * plotH;
    };

    const gridLevels = [0, 0.25, 0.5, 0.75, 1];
    const points = accData
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
        {/* Points (last one emphasized) */}
        {accData.map((d, i) => {
          const isLast = i === lastIdx;
          return (
            <Circle
              key={`pt-${i}`}
              cx={xAt(i)}
              cy={yAt(d.accuracy)}
              r={isLast ? 5 : 3}
              fill={isLast ? colors.primary : colors.surface}
              stroke={colors.primary}
              strokeWidth={isLast ? 2 : 1.5}
            />
          );
        })}
        {/* First / last date labels */}
        <SvgText
          x={xAt(0)}
          y={CHART_HEIGHT - 6}
          fontSize={9}
          fill={colors.textTertiary}
          textAnchor="start"
        >
          {shortDate(accData[0]?.date ?? "")}
        </SvgText>
        {n > 1 ? (
          <SvgText
            x={xAt(lastIdx)}
            y={CHART_HEIGHT - 6}
            fontSize={9}
            fill={colors.textTertiary}
            textAnchor="end"
          >
            {shortDate(accData[lastIdx]?.date ?? "")}
          </SvgText>
        ) : null}
      </Svg>
    );
  };

  // ─── "Karten pro Tag" bar chart renderer ─────────────────────────────────
  const renderBarChart = (width: number) => {
    const PAD_L = 12;
    const PAD_R = 12;
    const PAD_T = 18;
    const PAD_B = 22;
    const plotW = Math.max(width - PAD_L - PAD_R, 10);
    const plotH = Math.max(BAR_CHART_HEIGHT - PAD_T - PAD_B, 10);
    const n = barData.length;
    const maxCount = Math.max(1, ...barData.map((d) => d.count));
    const slot = n > 0 ? plotW / n : plotW;
    const barW = Math.max(2, Math.min(slot * 0.6, 26));

    return (
      <Svg width={width} height={BAR_CHART_HEIGHT}>
        {/* Baseline */}
        <Line
          x1={PAD_L}
          y1={PAD_T + plotH}
          x2={PAD_L + plotW}
          y2={PAD_T + plotH}
          stroke={colors.border}
          strokeWidth={1}
        />
        {/* Bars */}
        {barData.map((d, i) => {
          const bh = maxCount > 0 ? (d.count / maxCount) * plotH : 0;
          const drawH = d.count > 0 ? Math.max(bh, 2) : 0;
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const y = PAD_T + plotH - drawH;
          const isMax = d.count === maxCount && d.count > 0;
          return (
            <Rect
              key={`bar-${i}`}
              x={x}
              y={y}
              width={barW}
              height={drawH}
              rx={2}
              fill={colors.primary}
              fillOpacity={isMax ? 1 : 0.4}
            />
          );
        })}
        {/* Max-value label */}
        <SvgText
          x={PAD_L}
          y={12}
          fontSize={9}
          fill={colors.textTertiary}
          textAnchor="start"
        >
          {`max ${maxCount} ${maxCount === 1 ? "Karte" : "Karten"}`}
        </SvgText>
        {/* First / last date labels */}
        <SvgText
          x={PAD_L + slot / 2}
          y={BAR_CHART_HEIGHT - 6}
          fontSize={9}
          fill={colors.textTertiary}
          textAnchor="middle"
        >
          {shortDate(barData[0]?.date ?? "")}
        </SvgText>
        {n > 1 ? (
          <SvgText
            x={PAD_L + (n - 1) * slot + slot / 2}
            y={BAR_CHART_HEIGHT - 6}
            fontSize={9}
            fill={colors.textTertiary}
            textAnchor="middle"
          >
            {shortDate(barData[n - 1]?.date ?? "")}
          </SvgText>
        ) : null}
      </Svg>
    );
  };

  const miniStats: Array<{
    key: string;
    icon: React.ReactNode;
    value: string;
    label: string;
  }> = [
    {
      key: "accuracy",
      icon: <TrendingUp size={18} color={colors.success} />,
      value: accuracyDisplay,
      label: "Genauigkeit",
    },
    {
      key: "streak",
      icon: <Flame size={18} color={colors.warning} />,
      value: String(streak),
      label: streak === 1 ? "Tag Streak" : "Tage Streak",
    },
    {
      key: "reviews",
      icon: <CheckCircle2 size={18} color={colors.primary} />,
      value: reviewsTotal.toLocaleString("de-DE"),
      label: "Wiederholungen",
    },
  ];

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  const emptyStateText = (message: string) => (
    <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
      <Text
        style={{
          fontSize: typography.sm,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: typography.xxl,
              fontWeight: typography.bold,
              color: colors.text,
            }}
          >
            Dein Fortschritt
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : error ? (
          <View style={cardStyle}>
            <Text
              style={{
                color: colors.error,
                fontSize: typography.base,
                fontWeight: typography.semibold,
                marginBottom: spacing.xs,
              }}
            >
              Konnte deine Statistik nicht laden.
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
              Bitte versuche es später noch einmal.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary row */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {miniStats.map((s) => (
                <View
                  key={s.key}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...shadows.sm,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.sm,
                      backgroundColor: colors.surfaceSecondary,
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: spacing.sm,
                    }}
                  >
                    {s.icon}
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: typography.extrabold,
                      color: colors.text,
                    }}
                  >
                    {s.value}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textSecondary,
                      marginTop: 2,
                      textAlign: "center",
                    }}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Accuracy line chart */}
            <View style={{ ...cardStyle, gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <TrendingUp size={18} color={colors.primary} />
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                    color: colors.text,
                  }}
                >
                  Genauigkeit — letzte 14 Tage
                </Text>
              </View>
              {hasAccuracyChart ? (
                <ResponsiveChart render={renderAccuracyChart} />
              ) : (
                emptyStateText(
                  "Lerne ein paar Tage, dann siehst du hier deinen Verlauf."
                )
              )}
            </View>

            {/* Reviews-per-day bar chart */}
            <View style={{ ...cardStyle, gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <CheckCircle2 size={18} color={colors.primary} />
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                    color: colors.text,
                  }}
                >
                  Karten pro Tag
                </Text>
              </View>
              {hasBarChart ? (
                <ResponsiveChart render={renderBarChart} />
              ) : (
                emptyStateText(
                  "Noch keine Wiederholungen. Lerne los, dann füllt sich dieser Verlauf."
                )
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
