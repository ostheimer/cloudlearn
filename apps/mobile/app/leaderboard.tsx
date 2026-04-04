import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Crown,
  Medal,
  Trophy,
  Users,
  Globe,
  Flame,
  Zap,
} from "lucide-react-native";
import {
  getGlobalLeaderboard,
  getFriendsLeaderboard,
  type LeaderboardEntry,
} from "../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";

type Tab = "global" | "friends";

const RANK_ICONS: Record<number, React.ReactNode> = {};

function RankBadge({ rank, isCurrentUser, colors }: { rank: number; isCurrentUser: boolean; colors: ReturnType<typeof useColors> }) {
  if (rank === 1) return <Trophy size={22} color="#FFD700" fill="#FFD700" />;
  if (rank === 2) return <Medal size={22} color="#C0C0C0" fill="#C0C0C0" />;
  if (rank === 3) return <Medal size={22} color="#CD7F32" fill="#CD7F32" />;
  return (
    <View style={{
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: isCurrentUser ? colors.primary : colors.surfaceSecondary,
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{
        fontSize: typography.xs, fontWeight: typography.bold,
        color: isCurrentUser ? "#fff" : colors.textTertiary,
      }}>
        {rank}
      </Text>
    </View>
  );
}

function LeaderboardRow({ entry, colors }: { entry: LeaderboardEntry; colors: ReturnType<typeof useColors> }) {
  const isTop3 = entry.rank <= 3;
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: entry.isCurrentUser
        ? colors.primaryLight
        : isTop3 ? `${colors.warning}12` : "transparent",
      borderRadius: radius.md,
      marginBottom: 2,
      borderWidth: entry.isCurrentUser ? 1 : 0,
      borderColor: entry.isCurrentUser ? colors.primary : "transparent",
    }}>
      {/* Rank */}
      <View style={{ width: 36, alignItems: "center" }}>
        <RankBadge rank={entry.rank} isCurrentUser={entry.isCurrentUser} colors={colors} />
      </View>

      {/* Avatar placeholder */}
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: entry.isCurrentUser ? colors.primary : colors.surfaceSecondary,
        alignItems: "center", justifyContent: "center",
        marginHorizontal: spacing.sm,
      }}>
        <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: entry.isCurrentUser ? "#fff" : colors.textTertiary }}>
          {(entry.displayName?.[0] ?? "?").toUpperCase()}
        </Text>
      </View>

      {/* Name + streak */}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: typography.base, fontWeight: entry.isCurrentUser ? typography.bold : typography.medium,
            color: colors.text,
          }}
        >
          {entry.displayName}{entry.isCurrentUser ? " (Du)" : ""}
        </Text>
        {entry.currentStreak > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
            <Flame size={11} color={colors.warning} fill={colors.warning} />
            <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>
              {entry.currentStreak}
            </Text>
          </View>
        )}
      </View>

      {/* LP */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Zap size={14} color={colors.warning} fill={colors.warning} />
        <Text style={{
          fontSize: typography.base, fontWeight: typography.bold,
          color: entry.isCurrentUser ? colors.primary : colors.text,
        }}>
          {entry.lpBalance.toLocaleString("de-DE")}
        </Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const userId = useSessionStore((s) => s.userId);

  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [friendEntries, setFriendEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) {
      setGlobalEntries([]);
      setFriendEntries([]);
      setMyRank(null);
      setFriendCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [global, friends] = await Promise.all([
        getGlobalLeaderboard(),
        getFriendsLeaderboard(),
      ]);
      setGlobalEntries(global.entries);
      setMyRank(global.myRank);
      setFriendEntries(friends.entries);
      setFriendCount(friends.friendCount);
    } catch {
      setError(t("leaderboard.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const entries = activeTab === "global" ? globalEntries : friendEntries;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            {t("leaderboard.title")}
          </Text>
          {myRank && activeTab === "global" && (
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
              {t("leaderboard.yourRank", { rank: myRank })}
            </Text>
          )}
        </View>
        <Crown size={24} color={colors.warning} fill={colors.warning} />
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: "row", gap: spacing.sm,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
      }}>
        {(["global", "friends"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.full,
              backgroundColor: activeTab === tab ? colors.primary : colors.surfaceSecondary,
            }}
          >
            {tab === "global"
              ? <Globe size={14} color={activeTab === tab ? "#fff" : colors.textTertiary} />
              : <Users size={14} color={activeTab === tab ? "#fff" : colors.textTertiary} />}
            <Text style={{
              fontSize: typography.sm, fontWeight: typography.semibold,
              color: activeTab === tab ? "#fff" : colors.textSecondary,
            }}>
              {tab === "global" ? t("leaderboard.tabGlobal") : t("leaderboard.tabFriends", { count: friendCount })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text>
          <TouchableOpacity
            onPress={() => { void loadData(); }}
            style={{ marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md }}
          >
            <Text style={{ color: "#fff" }}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl }}>
          <Users size={40} color={colors.textTertiary} style={{ marginBottom: spacing.md }} />
          <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text, textAlign: "center" }}>
            {activeTab === "friends" ? t("leaderboard.noFriends") : t("leaderboard.noEntries")}
          </Text>
          {activeTab === "friends" && (
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm }}>
              {t("leaderboard.noFriendsHint")}
            </Text>
          )}
          {activeTab === "friends" && (
            <TouchableOpacity
              onPress={() => router.push("/referral")}
              style={{ marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}
            >
              <Text style={{ color: "#fff", fontWeight: typography.semibold }}>{t("leaderboard.inviteFriends")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <LeaderboardRow entry={item} colors={colors} />}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          // Sticky header with top 3 podium
          ListHeaderComponent={entries.length >= 3 ? (
            <View style={{
              flexDirection: "row", alignItems: "flex-end", justifyContent: "center",
              gap: spacing.sm, paddingVertical: spacing.lg, marginBottom: spacing.md,
            }}>
              {[entries[1], entries[0], entries[2]].map((entry, i) => {
                if (!entry) return null;
                const heights = [80, 100, 70];
                const podiumColors = ["#C0C0C0", "#FFD700", "#CD7F32"];
                return (
                  <View key={entry.userId} style={{ alignItems: "center", gap: spacing.xs }}>
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: entry.isCurrentUser ? colors.primary : colors.surfaceSecondary,
                      alignItems: "center", justifyContent: "center",
                      borderWidth: 2, borderColor: podiumColors[i] ?? colors.border,
                    }}>
                      <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                        {(entry.displayName?.[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: typography.xs, color: colors.textSecondary, maxWidth: 70, textAlign: "center" }} numberOfLines={1}>
                      {entry.displayName}
                    </Text>
                    <View style={{
                      width: 56, height: heights[i],
                      backgroundColor: `${podiumColors[i]}33`,
                      borderTopLeftRadius: 4, borderTopRightRadius: 4,
                      alignItems: "center", justifyContent: "flex-start",
                      paddingTop: spacing.sm,
                    }}>
                      <Text style={{ fontSize: typography.lg, fontWeight: typography.extrabold, color: podiumColors[i] }}>
                        {entry.rank}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}
