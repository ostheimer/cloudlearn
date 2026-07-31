import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Award,
  ChevronLeft,
  ChevronRight,
  Flame,
  Shield,
  Users,
} from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";
import { supabase } from "../src/lib/supabase";
import { todayLocal } from "../src/lib/localDay";
import {
  getStats,
  getStreakCalendar,
  type StatsResponse,
  type StreakCalendarResponse,
} from "../src/lib/api";

// „Heute" in der Server-Zeitzone (#612) — die Geräte-Zeitzone markierte auf
// Reisen den falschen Tag im Kalender. Gleiche Quelle wie die Startseite.
function todayLocalDate(): string {
  return todayLocal();
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = (y ?? 0) * 12 + ((m ?? 1) - 1) + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = (total % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y ?? 0, m ?? 1, 0).getDate();
}

/** Column of the month's first day in a Monday-first week (Mo = 0). */
function firstWeekdayOffset(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return (new Date(y ?? 0, (m ?? 1) - 1, 1).getDay() + 6) % 7;
}

export default function StreakCalendarScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colors = useColors();

  const currentMonth = todayLocalDate().slice(0, 7);
  const userId = useSessionStore((s) => s.userId);
  const [month, setMonth] = useState(currentMonth);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [calendar, setCalendar] = useState<StreakCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Before signup there was nothing to learn — paging back ends there, same
  // rule as on the web calendar. The date lives in the local Supabase session,
  // no API call needed; created_at is UTC, which is close enough for a month
  // boundary (at worst one extra month is allowed, never one too few).
  const [signupMonth, setSignupMonth] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const created = data.session?.user.created_at;
        if (active && created) setSignupMonth(created.slice(0, 7));
      })
      .catch(() => {
        // Without the date, paging back stays open as before.
      });
    return () => {
      active = false;
    };
  }, []);

  // /api/v1/stats is heavier than the calendar endpoint (decks, due cards, full
  // review stats), so it lands noticeably later. Refetch on focus and keep the
  // last known values; the chips render a placeholder (not a misleading 0) until
  // the first response arrives.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      getStats()
        .then((res) => setStats(res.stats))
        .catch(() => { /* keep last known values; chips show a placeholder */ });
    }, [userId])
  );

  const loadMonth = useCallback((m: string) => {
    setLoading(true);
    setError(false);
    getStreakCalendar(m)
      .then((res) => setCalendar(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMonth(month);
  }, [month, loadMonth]);

  const today = todayLocalDate();
  const learned = new Set(calendar?.learnedDays ?? []);
  const frozen = new Set(calendar?.frozenDays ?? []);
  const atCurrentMonth = month >= currentMonth;
  const atSignupMonth = signupMonth !== null && month <= signupMonth;

  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(y ?? 0, (m ?? 1) - 1, 1).toLocaleDateString(
    i18n.language?.startsWith("de") ? "de-DE" : "en-US",
    { month: "long", year: "numeric" }
  );
  const weekdays = t("streakCal.weekdays").split(",");

  const offset = firstWeekdayOffset(month);
  const dayCount = daysInMonth(month);
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => i + 1),
  ];

  const streakFreezes = stats?.streakFreezes ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            {t("streakCal.title")}
          </Text>
        </View>

        {/* Summary chips */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.warningLight,
              borderRadius: radius.md,
              padding: spacing.md,
              alignItems: "center",
              gap: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Flame size={16} color={colors.warning} fill={colors.warning} />
              <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.warning }}>
                {stats ? stats.currentStreak : "–"}
              </Text>
            </View>
            <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
              {t("streakCal.current")}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              alignItems: "center",
              gap: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Shield size={16} color={colors.warning} />
              <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                {stats ? streakFreezes : "–"}
              </Text>
            </View>
            <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
              {t("streakCal.freezes")}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              alignItems: "center",
              gap: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Award size={16} color={colors.textTertiary} />
              <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                {stats ? stats.longestStreak : "–"}
              </Text>
            </View>
            <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
              {t("streakCal.best")}
            </Text>
          </View>
        </View>

        {/* Month navigation */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TouchableOpacity
              onPress={() => setMonth((prev) => shiftMonth(prev, -1))}
              disabled={atSignupMonth}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <ChevronLeft size={22} color={atSignupMonth ? colors.textTertiary : colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
              {monthLabel}
            </Text>
            <TouchableOpacity
              onPress={() => setMonth((prev) => shiftMonth(prev, 1))}
              disabled={atCurrentMonth}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <ChevronRight size={22} color={atCurrentMonth ? colors.textTertiary : colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={{ flexDirection: "row" }}>
            {weekdays.map((label) => (
              <View key={label} style={{ width: `${100 / 7}%`, alignItems: "center" }}>
                <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : error ? (
            <Text style={{ textAlign: "center", color: colors.error, fontSize: typography.sm, marginVertical: spacing.lg }}>
              {t("streakCal.loadError")}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                }
                const dateStr = `${month}-${String(day).padStart(2, "0")}`;
                const isFrozen = frozen.has(dateStr);
                const isLearned = !isFrozen && learned.has(dateStr);
                const isToday = dateStr === today;
                const isFuture = dateStr > today;
                return (
                  <View key={dateStr} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: radius.full,
                        backgroundColor: isLearned ? colors.warningLight : "transparent",
                        borderWidth: isToday ? 2 : isFrozen ? 1.5 : 0,
                        borderColor: isToday ? colors.primary : colors.warning,
                        borderStyle: isFrozen && !isToday ? "dashed" : "solid",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {isFrozen ? (
                        <Shield size={15} color={colors.warning} />
                      ) : isLearned ? (
                        <Flame size={15} color={colors.warning} fill={colors.warning} />
                      ) : (
                        <Text
                          style={{
                            fontSize: typography.xs,
                            color: isFuture ? colors.textTertiary : colors.textSecondary,
                          }}
                        >
                          {day}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Legend */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Flame size={13} color={colors.warning} fill={colors.warning} />
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
                {t("streakCal.legendLearned")}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Shield size={13} color={colors.warning} />
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
                {t("streakCal.legendFrozen")}
              </Text>
            </View>
            {/* „Heute" wie im Web (#571): Der heutige Tag ist umrandet, was die
                Legende bisher nicht erklärt hat. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: radius.full,
                  borderWidth: 2,
                  borderColor: colors.primary,
                }}
              />
              <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
                {t("streakCal.legendToday")}
              </Text>
            </View>
            <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
              {t("streakCal.legendEmpty")}
            </Text>
          </View>
        </View>

        {/* Shortcut to the LP store to stock up on freezes */}
        <TouchableOpacity
          onPress={() => router.push("/lp-store")}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <Shield size={18} color={colors.warning} />
          <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary }}>
            {t("streakCal.buyFreeze")}
          </Text>
        </TouchableOpacity>

        {/* Shortcut to shared friend streaks (#237) */}
        <TouchableOpacity
          onPress={() => router.push("/friend-streaks")}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
          }}
        >
          <Users size={18} color={colors.primary} />
          <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary }}>
            {t("streakCal.friendStreak")}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
