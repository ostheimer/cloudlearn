import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BookOpen,
  ScanLine,
  Brain,
  Layers,
  ChevronRight,
  Flame,
  HeartCrack,
  HeartHandshake,
  Target,
  TrendingUp,
  Award,
  Shield,
  Users,
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { getStats, listDecks, getFriendStreaks, buyStreakRepair, isApiError, type StatsResponse, type Deck, type FriendStreak } from "../../src/lib/api";
import { getLastUsedDeck, type LastUsedDeck } from "../../src/lib/lastUsedDeck";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { LpBadge } from "../../src/components/LpBadge";
import { AuthPromptCard } from "../../src/components/AuthPromptCard";
import { NotificationPermissionPrompt } from "../../src/components/NotificationPermissionPrompt";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const setDueCount = useSessionStore((state) => state.setDueCount);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [recentDeck, setRecentDeck] = useState<Deck | null>(null);
  const [lastUsed, setLastUsed] = useState<LastUsedDeck | null>(null);
  const [friendStreaks, setFriendStreaks] = useState<FriendStreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repairing, setRepairing] = useState(false);

  const loadHomeData = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    Promise.all([
      getStats().then((res) => {
        setStats(res.stats);
        setDueCount(res.stats.dueCards ?? 0);
      }),
      Promise.all([listDecks(userId), getLastUsedDeck()]).then(([res, stored]) => {
        if (res.decks.length > 0) {
          const sorted = [...res.decks].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setRecentDeck(sorted[0] ?? null);
        }
        // Only trust the on-device marker while that deck still exists.
        setLastUsed(
          stored && res.decks.some((d) => d.id === stored.id) ? stored : null
        );
      }),
      // Friend streaks power the Freunde tile + the "partner waiting" nudge.
      // Self-contained catch so a social hiccup never breaks the Home load.
      getFriendStreaks()
        .then((res) => setFriendStreaks(res.streaks))
        .catch(() => setFriendStreaks([])),
    ])
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId, setDueCount]);

  // Load on first focus and when returning to Home (e.g. after learning session) so badge and "Fällig" stay in sync
  useFocusEffect(
    useCallback(() => {
      if (userId) loadHomeData();
    }, [userId, loadHomeData])
  );

  const dueCount = stats?.dueCards ?? 0;
  const deckCount = stats?.totalDecks ?? 0;
  const streak = stats?.currentStreak ?? 0;
  const streakFreezes = stats?.streakFreezes ?? 0;
  const repairAvailable = stats?.repairAvailable ?? false;
  const repairBrokenStreak = stats?.repairBrokenStreak ?? 0;
  const repairCost = stats?.repairCost ?? 40;

  // Friend-streak summary for Home: the best shared streak drives the tile,
  // and a partner who studied today (while you haven't) drives the nudge.
  const activeFriendStreaks = friendStreaks.filter((s) => s.status === "active");
  const bestFriendStreak = activeFriendStreaks.reduce((max, s) => Math.max(max, s.currentStreak), 0);
  const waitingPartner =
    activeFriendStreaks.find((s) => s.friendStudiedToday && !s.youStudiedToday) ?? null;

  const handleRepair = useCallback(() => {
    Alert.alert(
      "Streak zurückholen?",
      `Das kostet ${repairCost} LP und stellt deinen ${repairBrokenStreak}-Tage-Streak wieder her.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Zurückholen",
          onPress: async () => {
            setRepairing(true);
            try {
              await buyStreakRepair();
              loadHomeData();
            } catch (err) {
              // The server owns price, window and eligibility; translate its codes.
              const message = isApiError(err) && err.code === "INSUFFICIENT_LP"
                ? "Dafür reichen deine LP noch nicht."
                : isApiError(err) && err.code === "NO_REPAIR"
                  ? "Diese Reparatur ist nicht mehr möglich."
                  : "Zurückholen fehlgeschlagen. Versuch es später noch einmal.";
              Alert.alert("Streak-Reparatur", message);
              loadHomeData();
            } finally {
              setRepairing(false);
            }
          },
        },
      ]
    );
  }, [repairCost, repairBrokenStreak, loadHomeData]);
  const reviewsToday = stats?.reviewsToday ?? 0;
  const dailyGoal = stats?.dailyGoal ?? 30;
  const dailyProgress = dailyGoal > 0 ? Math.min(reviewsToday / dailyGoal, 1) : 0;
  const accuracyPercent = Math.round((stats?.accuracyRate ?? 0) * 100);

  // Determine whether user has reviewed today. The device's local calendar
  // date (sv-SE renders YYYY-MM-DD) matches the server's local-day streak
  // dates — toISOString() would flip to the next day at UTC midnight (#211).
  const today = new Date().toLocaleDateString("sv-SE");
  const reviewedToday = stats?.lastReviewDate === today;

  // "Zuletzt genutzt": prefer the deck last opened on this device — practice
  // modes leave no review_logs, so the server only sees Karteikarten sessions.
  // Fall back to the server's last-reviewed deck, then to the last-edited one.
  const lastStudied = stats?.lastStudiedDeck ?? null;
  const shownDeck =
    lastUsed ??
    lastStudied ??
    (recentDeck ? { id: recentDeck.id, title: recentDeck.title } : null);
  const shownDeckLabel = lastUsed
    ? "Zuletzt genutzt"
    : lastStudied
      ? "Zuletzt gelernt"
      : "Zuletzt geändert";

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.xl,
            paddingBottom: spacing.xxxl + spacing.xl,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              paddingTop: spacing.lg,
              gap: spacing.xs,
            }}
          >
            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              clearn
            </Text>
            <Text
              style={{
                fontSize: typography.base,
                color: colors.textSecondary,
              }}
            >
              Foto — Flashcards — Wissen
            </Text>
          </View>

          <AuthPromptCard
            title="Ohne Konto starten"
            body="Du kannst clearn zuerst ansehen. Für Scan, Decks, Lernfortschritt und Synchronisierung brauchst du danach ein Konto."
            ctaLabel="Anmelden oder registrieren"
            onPress={() => router.push("/auth")}
          />

          <View style={{ gap: spacing.md }}>
            {[
              {
                icon: <ScanLine size={20} color={colors.primary} />,
                title: "Scan",
                body: "Fotos, PDFs und Texte werden nach dem Login zu Karten.",
              },
              {
                icon: <BookOpen size={20} color={colors.primary} />,
                title: "Decks",
                body: "Decks, Kurse und Ordner synchronisieren wir mit deinem Konto.",
              },
              {
                icon: <Brain size={20} color={colors.primary} />,
                title: "Lernen",
                body: "Später kannst du deinen Fortschritt über alle Geräte mitnehmen.",
              },
            ].map((item) => (
              <View
                key={item.title}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.md,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: colors.primaryLight,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text
                    style={{
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                      color: colors.text,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                      lineHeight: 22,
                    }}
                  >
                    {item.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xxxl + spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingTop: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              clearn
            </Text>
            <Text
              style={{
                fontSize: typography.base,
                color: colors.textSecondary,
                marginTop: spacing.xs,
              }}
            >
              Foto — Karte — Wissen
            </Text>
          </View>
          <LpBadge onPress={() => router.push("/lp-store")} />
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            {error ? (
              <Text style={{ color: colors.error }}>{error}</Text>
            ) : null}

            {/* Streak repair prompt — only while a lost streak is still repairable (#237) */}
            {repairAvailable ? (
              <View
                style={{
                  backgroundColor: colors.errorLight,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.error,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: colors.surface,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <HeartCrack size={22} color={colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.text }}>
                      Streak gerissen
                    </Text>
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                      Dein {repairBrokenStreak}-Tage-Streak ist weg
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleRepair}
                  disabled={repairing}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                  }}
                >
                  {repairing ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <>
                      <HeartHandshake size={16} color={colors.textInverse} />
                      <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.textInverse }}>
                        Für {repairCost} LP zurückholen
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Streak banner — opens the streak calendar (#237) */}
            <TouchableOpacity
              onPress={() => router.push("/streak-calendar")}
              activeOpacity={0.8}
              style={{
                backgroundColor: streak > 0 ? colors.warningLight : colors.surfaceSecondary,
                borderRadius: radius.lg,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                borderWidth: 1,
                borderColor: streak > 0 ? colors.warning : colors.border,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: streak > 0 ? colors.warning : colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: streak > 0 ? 0.25 : 1,
                }}
              >
                <Flame
                  size={26}
                  color={streak > 0 ? colors.warning : colors.textTertiary}
                  fill={streak > 0 ? colors.warning : "none"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: typography.extrabold,
                    color: streak > 0 ? colors.warning : colors.textTertiary,
                  }}
                >
                  {streak} {streak === 1 ? "Tag" : "Tage"}
                </Text>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: streak > 0 ? colors.textSecondary : colors.textTertiary,
                    marginTop: 2,
                  }}
                >
                  {streak === 0
                    ? "Starte deinen Streak!"
                    : !reviewedToday
                      ? "Lerne heute, um deinen Streak zu halten!"
                      : "Weiter so!"}
                </Text>
              </View>
              {streakFreezes > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                  }}
                >
                  <Shield size={14} color={colors.warning} />
                  <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: colors.text }}>
                    {streakFreezes}
                  </Text>
                </View>
              ) : null}
              {stats?.longestStreak && stats.longestStreak > 0 ? (
                <View style={{ alignItems: "center" }}>
                  <Award size={16} color={colors.textTertiary} />
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    Best: {stats.longestStreak}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Friend-streak nudge — partner studied today, you haven't yet (#237) */}
            {waitingPartner ? (
              <TouchableOpacity
                onPress={() => router.push("/friend-streaks")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.warningLight,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.warning,
                  padding: spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Users size={20} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text }}>
                    {waitingPartner.displayName} hat heute gelernt
                  </Text>
                  <Text style={{ fontSize: typography.xs, color: colors.textSecondary, marginTop: 1 }}>
                    Lern auch du, damit eure Flamme weiterbrennt
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}

            {/* Daily goal progress — tappable to open the goal setter */}
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: "/daily-goal", params: { current: String(dailyGoal) } })
              }
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Target size={18} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    Tagesziel
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: typography.bold,
                      color: dailyProgress >= 1 ? colors.success : colors.primary,
                    }}
                  >
                    {reviewsToday}/{dailyGoal} Karten
                  </Text>
                  <ChevronRight size={16} color={colors.textTertiary} />
                </View>
              </View>
              {/* Progress bar */}
              <View
                style={{
                  height: 8,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.max(dailyProgress * 100, 1)}%`,
                    backgroundColor: dailyProgress >= 1 ? colors.success : colors.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
            </TouchableOpacity>

            {/* Stats cards row */}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {/* Freunde — replaces the old dead "Fällig" tile; the due count
                  now rides on the Bibliothek tile below. Opens shared streaks. */}
              <TouchableOpacity
                onPress={() => router.push("/friend-streaks")}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: waitingPartner ? colors.warning : colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: colors.primaryLight,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  <Users size={18} color={colors.primary} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  {bestFriendStreak > 0 ? (
                    <Flame size={15} color={colors.warning} fill={colors.warning} />
                  ) : null}
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: typography.extrabold,
                      color: colors.text,
                    }}
                  >
                    {bestFriendStreak}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Freunde
                </Text>
                <View
                  style={{
                    marginTop: 6,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full ?? 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.xs,
                      fontWeight: typography.bold,
                      color: colors.primary,
                    }}
                  >
                    Öffnen  ›
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Decks */}
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/decks")}
                activeOpacity={0.8}
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
                  <Layers size={18} color={colors.textSecondary} />
                </View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {deckCount}
                </Text>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Decks
                </Text>
                <View
                  style={{
                    marginTop: 6,
                    backgroundColor: dueCount > 0 ? colors.warningLight : colors.surfaceSecondary,
                    borderRadius: radius.full ?? 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.xs,
                      fontWeight: typography.bold,
                      color: dueCount > 0 ? colors.warning : colors.primary,
                    }}
                  >
                    {dueCount > 0 ? `${dueCount} fällig  ›` : "Bibliothek  ›"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Accuracy */}
              <TouchableOpacity
                onPress={() => router.push("/stats")}
                activeOpacity={0.8}
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
                    backgroundColor:
                      accuracyPercent >= 70 ? colors.successLight : colors.surfaceSecondary,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: spacing.sm,
                  }}
                >
                  <TrendingUp
                    size={18}
                    color={
                      accuracyPercent >= 70 ? colors.success : colors.textTertiary
                    }
                  />
                </View>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: typography.extrabold,
                    color: colors.text,
                  }}
                >
                  {(stats?.reviewsTotal ?? 0) > 0 ? `${accuracyPercent}%` : "—"}
                </Text>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Genauigkeit
                </Text>
                <View
                  style={{
                    marginTop: 6,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full ?? 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.xs,
                      fontWeight: typography.bold,
                      color: colors.primary,
                    }}
                  >
                    Statistik  ›
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Recently studied deck — opens that deck's view, where every
                study mode (and the tab bar) is available. */}
            {shownDeck && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/deck/[id]",
                    params: { id: shownDeck.id, title: shownDeck.title },
                  })
                }
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    backgroundColor: colors.primaryLight,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <BookOpen size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: typography.xs,
                      color: colors.textTertiary,
                      marginBottom: 2,
                    }}
                  >
                    {shownDeckLabel}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                    numberOfLines={1}
                  >
                    {shownDeck.title}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}

            {/* Action buttons */}
            <View style={{ gap: spacing.md }}>{/* The parked global "learn all
              due cards" button is gone for good — learning starts from a deck
              (Bibliothek shows which decks are due). */}

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/scan")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  ...shadows.md,
                }}
              >
                <ScanLine size={20} color={colors.textInverse} />
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Neuen Text scannen
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      {/* One-time notification permission ask (Etappe 0) — only for logged-in users. */}
      <NotificationPermissionPrompt />
    </SafeAreaView>
  );
}
