import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import {
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Layers,
} from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import {
  fetchDeckSummaries,
  fetchStats,
  type DeckSummary,
  type StatsWithDuration,
} from "../../src/lib/statsApi";
import {
  AccuracyRing,
  AccuracyTrendChart,
  ResponsiveChart,
  shortDate,
  shortDay,
} from "../../src/components/statsCharts";

const BAR_CHART_HEIGHT = 160;

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;

/** "Montag, 07.07." — weekday computed at UTC noon to dodge timezone edges. */
function dayTitle(iso: string): string {
  const nums = iso.split("-").map(Number);
  const [y, m, d] = nums;
  if (nums.length < 3 || nums.some((p) => Number.isNaN(p))) return shortDate(iso);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12));
  return `${WEEKDAYS[date.getUTCDay()] ?? ""}, ${shortDate(iso)}`;
}

export default function StatsScreen() {
  const colors = useColors();
  const router = useRouter();

  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [stats, setStats] = useState<StatsWithDuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ─── "Pro Deck" summaries (fixed 30-day window, weakest deck first) ──────
  const [deckSummaries, setDeckSummaries] = useState<DeckSummary[] | null>(null);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksError, setDecksError] = useState(false);

  const loadDeckSummaries = useCallback(() => {
    let cancelled = false;
    setDecksLoading(true);
    setDecksError(false);
    fetchDeckSummaries()
      .then((decks) => {
        if (!cancelled) setDeckSummaries(decks);
      })
      .catch(() => {
        if (!cancelled) setDecksError(true);
      })
      .finally(() => {
        if (!cancelled) setDecksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadDeckSummaries(), [loadDeckSummaries]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchStats(rangeDays)
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
  }, [rangeDays]);

  const switchRange = (days: 7 | 30) => {
    if (days === rangeDays) return;
    setSelectedDate(null); // Auswahl gilt nur innerhalb eines Zeitraums
    setRangeDays(days);
  };

  // ─── Chart data (guard undefined / sort ascending) ───────────────────────
  const accData = [...(stats?.accuracyByDay ?? [])]
    .filter(
      (d) =>
        d != null &&
        typeof d.date === "string" &&
        typeof d.accuracy === "number" &&
        !Number.isNaN(d.accuracy) &&
        typeof d.count === "number" &&
        !Number.isNaN(d.count)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const barData = [...(stats?.reviewsByDay ?? [])]
    .filter(
      (d) =>
        d != null &&
        typeof d.date === "string" &&
        typeof d.count === "number" &&
        !Number.isNaN(d.count)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const durationByDate: Record<string, number> = {};
  for (const d of stats?.durationMsByDay ?? []) {
    if (d != null && typeof d.date === "string" && typeof d.durationMs === "number") {
      durationByDate[d.date] = d.durationMs;
    }
  }

  const accuracyByDate: Record<string, number> = {};
  for (const d of accData) {
    accuracyByDate[d.date] = d.accuracy;
  }

  // ─── Derived accuracy values (for the chosen window) ─────────────────────
  const reviewsTotal = stats?.reviewsTotal ?? 0;
  const windowCount = accData.reduce((sum, d) => sum + d.count, 0);
  const windowGood = accData.reduce(
    (sum, d) => sum + Math.round(d.accuracy * d.count),
    0
  );
  const windowAccuracy = windowCount > 0 ? windowGood / windowCount : 0;

  const hasAccuracyChart = accData.length >= 2;
  const hasBarChart = barData.some((d) => d.count > 0);

  const selectedDay = selectedDate
    ? barData.find((d) => d.date === selectedDate)
    : undefined;
  const selectedAccuracy = selectedDay
    ? accuracyByDate[selectedDay.date]
    : undefined;
  const selectedMinutes = selectedDay
    ? Math.round((durationByDate[selectedDay.date] ?? 0) / 60000)
    : 0;

  // ─── "Pro Deck" order: weakest accuracy first, zero-answer decks last ────
  const sortedSummaries = [...(deckSummaries ?? [])].sort((a, b) => {
    const aHas = a.answersTotal > 0;
    const bHas = b.answersTotal > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas) return a.accuracyRate - b.accuracyRate;
    return 0;
  });

  // ─── "Karten pro Tag" bar chart renderer ─────────────────────────────────
  const renderBarChart = (width: number) => {
    const PAD_L = 12;
    const PAD_R = 12;
    const PAD_T = 26;
    const PAD_B = 22;
    const plotW = Math.max(width - PAD_L - PAD_R, 10);
    const plotH = Math.max(BAR_CHART_HEIGHT - PAD_T - PAD_B, 10);
    const n = barData.length;
    const maxCount = Math.max(1, ...barData.map((d) => d.count));
    const slot = n > 0 ? plotW / n : plotW;
    // 30 days: thin bars (slot minus small gap), no value labels — the
    // per-day details live in the tap card instead.
    const dense = n > 10;
    const barW = dense
      ? Math.max(2, slot - 3)
      : Math.max(2, Math.min(slot * 0.6, 26));
    const showValueLabels = !dense;

    return (
      <View>
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
            const isSelected = selectedDay?.date === d.date;
            const fill = isSelected ? colors.accent : colors.primary;
            const fillOpacity = selectedDay
              ? isSelected
                ? 1
                : 0.35
              : isMax
                ? 1
                : 0.4;
            return (
              <G key={`bar-${i}`}>
                <Rect
                  x={x}
                  y={y}
                  width={barW}
                  height={drawH}
                  rx={2}
                  fill={fill}
                  fillOpacity={fillOpacity}
                />
                {showValueLabels && d.count > 0 ? (
                  <SvgText
                    x={x + barW / 2}
                    y={y - 4}
                    fontSize={10}
                    fontWeight="bold"
                    fill={isSelected ? colors.accent : colors.textSecondary}
                    textAnchor="middle"
                  >
                    {String(d.count)}
                  </SvgText>
                ) : null}
              </G>
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
          {/* X-axis labels: every 5th day when dense (30 Tage), else every
              day gets its label ("07.", "08.", …) — the 7-day view. */}
          {dense
            ? barData.map((d, i) =>
                i % 5 === 0 ? (
                  <SvgText
                    key={`xlabel-${i}`}
                    x={PAD_L + i * slot + slot / 2}
                    y={BAR_CHART_HEIGHT - 6}
                    fontSize={9}
                    fill={colors.textTertiary}
                    textAnchor="middle"
                  >
                    {shortDate(d.date)}
                  </SvgText>
                ) : null
              )
            : barData.map((d, i) => (
                <SvgText
                  key={`xlabel-${i}`}
                  x={PAD_L + i * slot + slot / 2}
                  y={BAR_CHART_HEIGHT - 6}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="middle"
                >
                  {shortDay(d.date)}
                </SvgText>
              ))}
        </Svg>
        {/* Transparent tap targets over the bar slots. More reliable than
            onPress on SVG shapes and gives full-height touch areas even for
            tiny or empty bars. */}
        <View
          style={{
            position: "absolute",
            left: PAD_L,
            top: 0,
            width: plotW,
            height: BAR_CHART_HEIGHT,
            flexDirection: "row",
          }}
        >
          {barData.map((d) => (
            <Pressable
              key={`slot-${d.date}`}
              style={{ flex: 1, height: "100%" }}
              onPress={() =>
                setSelectedDate((current) => (current === d.date ? null : d.date))
              }
              accessibilityRole="button"
              accessibilityLabel={`${dayTitle(d.date)}: ${d.count} ${
                d.count === 1 ? "Karte" : "Karten"
              }`}
            />
          ))}
        </View>
      </View>
    );
  };

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  const cardTitleStyle = {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
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
        {/* Header — this is a top-level tab, so no back button. */}
        <View style={{ paddingTop: spacing.sm }}>
          <Text
            style={{
              fontSize: typography.xxl,
              fontWeight: typography.bold,
              color: colors.text,
            }}
          >
            Deine Statistik
          </Text>
        </View>

        {/* Range switch: 7 / 30 days (mirrors the leaderboard tab pills) */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {([7, 30] as const).map((days) => {
            const active = rangeDays === days;
            return (
              <TouchableOpacity
                key={days}
                onPress={() => switchRange(days)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surfaceSecondary,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.semibold,
                    color: active ? "#fff" : colors.textSecondary,
                  }}
                >
                  {days} Tage
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !stats ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : error && !stats ? (
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
        ) : stats ? (
          // While a range switch loads, the previous charts stay visible,
          // slightly dimmed and not tappable.
          <View
            style={{ gap: spacing.lg, opacity: loading ? 0.55 : 1 }}
            pointerEvents={loading ? "none" : "auto"}
          >
            {error ? (
              <View
                style={{
                  backgroundColor: colors.errorLight,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Text style={{ color: colors.error, fontSize: typography.sm }}>
                  Aktualisieren fehlgeschlagen — es werden die letzten Daten
                  angezeigt.
                </Text>
              </View>
            ) : null}

            {/* Genauigkeit — ring + context + trend (chosen window) */}
            <View style={{ ...cardStyle, gap: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <TrendingUp size={18} color={colors.primary} />
                <Text style={cardTitleStyle}>Genauigkeit</Text>
              </View>

              {windowCount > 0 ? (
                <>
                  {/* Ring + context row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.lg,
                    }}
                  >
                    <AccuracyRing
                      accuracy={windowAccuracy}
                      hasData={windowCount > 0}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontSize: typography.base,
                          fontWeight: typography.semibold,
                          color: colors.text,
                        }}
                      >
                        richtig beantwortet
                      </Text>
                      <Text
                        style={{
                          fontSize: typography.sm,
                          color: colors.textSecondary,
                        }}
                      >
                        bei {windowCount.toLocaleString("de-DE")} Antworten in
                        den letzten {rangeDays} Tagen
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View
                    style={{ height: 1, backgroundColor: colors.borderLight }}
                  />

                  {/* Trend line (>= 2 points) or hint */}
                  {hasAccuracyChart ? (
                    <View style={{ gap: spacing.xs }}>
                      <Text
                        style={{
                          fontSize: typography.xs,
                          color: colors.textTertiary,
                        }}
                      >
                        Verlauf — letzte {rangeDays} Tage
                      </Text>
                      <AccuracyTrendChart
                        data={accData}
                        showAllDates={rangeDays === 7}
                      />
                    </View>
                  ) : (
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
                    >
                      <TrendingUp size={14} color={colors.textSecondary} />
                      <Text
                        style={{
                          fontSize: typography.sm,
                          color: colors.textSecondary,
                        }}
                      >
                        Verlauf erscheint ab 2 Lern-Tagen
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                emptyStateText(
                  reviewsTotal > 0
                    ? `Keine Antworten in den letzten ${rangeDays} Tagen.`
                    : "Noch keine Antworten — leg los!"
                )
              )}
            </View>

            {/* Reviews-per-day bar chart. The card itself is pressable so a
                tap on the background deselects the day. */}
            <Pressable
              style={{ ...cardStyle, gap: spacing.sm }}
              onPress={() => setSelectedDate(null)}
              disabled={!selectedDay}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <CheckCircle2 size={18} color={colors.primary} />
                <Text style={cardTitleStyle}>Karten pro Tag</Text>
              </View>
              {hasBarChart ? (
                <>
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textTertiary,
                    }}
                  >
                    Tippe auf einen Balken für Details.
                  </Text>
                  <ResponsiveChart render={renderBarChart} />
                  {selectedDay ? (
                    <View
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        borderRadius: radius.md,
                        borderLeftWidth: 3,
                        borderLeftColor: colors.accent,
                        padding: spacing.md,
                        gap: spacing.xs,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: typography.sm,
                          fontWeight: typography.semibold,
                          color: colors.text,
                        }}
                      >
                        {dayTitle(selectedDay.date)}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          columnGap: spacing.lg,
                          rowGap: spacing.xs,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: typography.sm,
                            color: colors.textSecondary,
                          }}
                        >
                          {selectedDay.count === 1
                            ? "1 Karte"
                            : `${selectedDay.count} Karten`}
                        </Text>
                        {typeof selectedAccuracy === "number" ? (
                          <Text
                            style={{
                              fontSize: typography.sm,
                              color: colors.textSecondary,
                            }}
                          >
                            {Math.round(selectedAccuracy * 100)}% richtig
                          </Text>
                        ) : null}
                        {selectedMinutes >= 1 ? (
                          <Text
                            style={{
                              fontSize: typography.sm,
                              color: colors.textSecondary,
                            }}
                          >
                            {selectedMinutes} min gelernt
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                emptyStateText(
                  reviewsTotal > 0
                    ? `Keine Wiederholungen in den letzten ${rangeDays} Tagen.`
                    : "Noch keine Wiederholungen. Lerne los, dann füllt sich dieser Verlauf."
                )
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Pro Deck — Genauigkeit je Deck (feste 30-Tage-Sicht), das
            schwächste Deck zuerst; Decks ohne Antworten ans Ende. Eine Zeile
            antippen öffnet die Deck-Statistik. */}
        <View style={{ ...cardStyle, gap: spacing.sm }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Layers size={18} color={colors.primary} />
            <Text style={cardTitleStyle}>Pro Deck</Text>
          </View>
          <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>
            Genauigkeit der letzten 30 Tage — schwächstes Deck zuerst.
          </Text>

          {decksLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ paddingVertical: spacing.lg }}
            />
          ) : decksError ? (
            <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                Konnte die Deck-Liste nicht laden.
              </Text>
              <TouchableOpacity
                onPress={loadDeckSummaries}
                activeOpacity={0.8}
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.semibold,
                    color: colors.primary,
                  }}
                >
                  Erneut versuchen
                </Text>
              </TouchableOpacity>
            </View>
          ) : sortedSummaries.length === 0 ? (
            emptyStateText("Noch keine Decks — leg eins an, dann siehst du hier den Vergleich.")
          ) : (
            <View>
              {sortedSummaries.map((deck, i) => {
                const hasAnswers = deck.answersTotal > 0;
                const pct = Math.round(deck.accuracyRate * 100);
                return (
                  <TouchableOpacity
                    key={deck.deckId}
                    onPress={() =>
                      router.push(
                        `/deck-stats/${deck.deckId}?title=${encodeURIComponent(deck.title)}`
                      )
                    }
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasAnswers
                        ? `${deck.title}: ${pct} Prozent richtig`
                        : `${deck.title}: noch keine Antworten`
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      paddingVertical: spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderLight,
                    }}
                  >
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: typography.sm,
                          fontWeight: typography.semibold,
                          color: colors.text,
                        }}
                      >
                        {deck.title}
                      </Text>
                      {hasAnswers ? (
                        <View
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: colors.surfaceSecondary,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              height: "100%",
                              width: `${Math.max(pct, 2)}%`,
                              borderRadius: 3,
                              backgroundColor: colors.primary,
                            }}
                          />
                        </View>
                      ) : (
                        <Text
                          style={{
                            fontSize: typography.xs,
                            color: colors.textTertiary,
                          }}
                        >
                          noch keine Antworten
                        </Text>
                      )}
                    </View>
                    {hasAnswers ? (
                      <Text
                        style={{
                          width: 44,
                          textAlign: "right",
                          fontSize: typography.sm,
                          fontWeight: typography.bold,
                          color: colors.text,
                        }}
                      >
                        {pct}%
                      </Text>
                    ) : null}
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
