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
import { ArrowLeft, Bell, Check, Clock, Flame, UserPlus, Users, X } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";
import {
  getFriendStreaks,
  getFriends,
  inviteFriendStreak,
  acceptFriendStreak,
  remindFriendStreak,
  leaveFriendStreak,
  type FriendStreak,
  type FriendProfile,
} from "../src/lib/api";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}

const AVATAR_COLORS = ["#6366f1", "#d4537e", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6"];
function avatarColor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function Avatar({ id, name, size = 44 }: { id: string; name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(id),
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: typography.semibold, fontSize: size / 2.8 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export default function FriendStreaksScreen() {
  const router = useRouter();
  const colors = useColors();
  const userId = useSessionStore((s) => s.userId);

  const [streaks, setStreaks] = useState<FriendStreak[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    Promise.all([getFriendStreaks(), getFriends()])
      .then(([s, f]) => {
        setStreaks(s.streaks);
        setFriends(f.friends);
      })
      .catch(() => { /* best-effort; empty states show */ })
      .finally(() => setLoading(false));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const runAction = useCallback(
    async (friendId: string, fn: () => Promise<unknown>) => {
      setBusyId(friendId);
      try {
        await fn();
        load();
      } catch {
        Alert.alert("Freunde-Streak", "Das hat nicht geklappt. Versuch es später noch einmal.");
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const active = streaks.filter((s) => s.status === "active");
  const toAccept = streaks.filter((s) => s.status === "pending" && !s.invitedByYou);
  const sent = streaks.filter((s) => s.status === "pending" && s.invitedByYou);
  const inStreak = new Set(streaks.map((s) => s.friendId));
  const invitable = friends.filter((f) => !inStreak.has(f.userId));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            Freunde-Streak
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Active shared streaks */}
            {active.map((s) => (
              <View
                key={s.friendId}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  gap: spacing.md,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
                  <Avatar id={userId ?? "me"} name="Du" />
                  <View style={{ alignItems: "center" }}>
                    <Flame size={30} color={colors.warning} fill={s.currentStreak > 0 ? colors.warning : "none"} />
                    <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.warning }}>
                      {s.currentStreak}
                    </Text>
                  </View>
                  <Avatar id={s.friendId} name={s.displayName} />
                </View>
                <Text style={{ textAlign: "center", fontSize: typography.sm, color: colors.textSecondary }}>
                  {s.currentStreak > 0
                    ? `${s.currentStreak} ${s.currentStreak === 1 ? "Tag" : "Tage"} gemeinsam mit ${s.displayName}`
                    : `Lernt beide heute, um mit ${s.displayName} zu starten`}
                </Text>

                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                    {s.youStudiedToday ? <Check size={16} color={colors.success} /> : <Clock size={16} color={colors.textTertiary} />}
                    <Text style={{ fontSize: typography.sm, color: colors.text }}>
                      Du {s.youStudiedToday ? "erledigt" : "offen"}
                    </Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.sm }}>
                    {s.friendStudiedToday ? <Check size={16} color={colors.success} /> : <Clock size={16} color={colors.textTertiary} />}
                    <Text style={{ fontSize: typography.sm, color: colors.text }} numberOfLines={1}>
                      {s.displayName} {s.friendStudiedToday ? "erledigt" : "offen"}
                    </Text>
                  </View>
                </View>

                {!s.friendStudiedToday ? (
                  <TouchableOpacity
                    onPress={() => runAction(s.friendId, async () => {
                      const res = await remindFriendStreak(s.friendId);
                      Alert.alert("Freunde-Streak", res.sent ? `${s.displayName} wurde erinnert.` : `${s.displayName} lässt sich gerade nicht erreichen.`);
                    })}
                    disabled={busyId === s.friendId}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingVertical: spacing.md }}
                  >
                    <Bell size={15} color={colors.primary} />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.primary }}>
                      {s.displayName} erinnern
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => Alert.alert(
                    "Streak beenden?",
                    `Der gemeinsame Streak mit ${s.displayName} wird gelöscht.`,
                    [
                      { text: "Abbrechen", style: "cancel" },
                      { text: "Beenden", style: "destructive", onPress: () => runAction(s.friendId, () => leaveFriendStreak(s.friendId)) },
                    ]
                  )}
                >
                  <Text style={{ textAlign: "center", fontSize: typography.xs, color: colors.textTertiary }}>
                    Streak beenden
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Invites waiting for my response */}
            {toAccept.map((s) => (
              <View key={s.friendId} style={{ backgroundColor: colors.warningLight, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar id={s.friendId} name={s.displayName} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>{s.displayName}</Text>
                  <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>lädt dich zu einem gemeinsamen Streak ein</Text>
                </View>
                <TouchableOpacity
                  onPress={() => runAction(s.friendId, () => acceptFriendStreak(s.friendId))}
                  disabled={busyId === s.friendId}
                  style={{ backgroundColor: colors.warning, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}
                >
                  {busyId === s.friendId ? <ActivityIndicator color={colors.textInverse} /> : (
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: colors.textInverse }}>Annehmen</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {/* Invites I sent, still pending — nudge to accept or withdraw */}
            {sent.map((s) => (
              <View key={s.friendId} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Avatar id={s.friendId} name={s.displayName} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>{s.displayName}</Text>
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Einladung gesendet – wartet auf Antwort</Text>
                  </View>
                  <Clock size={18} color={colors.textTertiary} />
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => runAction(s.friendId, async () => {
                      const res = await remindFriendStreak(s.friendId);
                      Alert.alert("Freunde-Streak", res.sent ? `${s.displayName} wurde erinnert.` : `${s.displayName} lässt sich gerade nicht erreichen.`);
                    })}
                    disabled={busyId === s.friendId}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingVertical: spacing.sm }}
                  >
                    <Bell size={15} color={colors.primary} />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.primary }}>Erinnern</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Alert.alert(
                      "Einladung zurückziehen?",
                      `Deine Einladung an ${s.displayName} wird entfernt.`,
                      [
                        { text: "Abbrechen", style: "cancel" },
                        { text: "Zurückziehen", style: "destructive", onPress: () => runAction(s.friendId, () => leaveFriendStreak(s.friendId)) },
                      ]
                    )}
                    disabled={busyId === s.friendId}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: spacing.sm }}
                  >
                    <X size={15} color={colors.textSecondary} />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textSecondary }}>Zurückziehen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Friends not yet in a shared streak */}
            {invitable.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Users size={18} color={colors.primary} />
                  <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
                    Neuen Freunde-Streak starten
                  </Text>
                </View>
                {invitable.map((f) => (
                  <View key={f.userId} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <Avatar id={f.userId} name={f.displayName} size={38} />
                    <Text style={{ flex: 1, fontSize: typography.base, color: colors.text }} numberOfLines={1}>{f.displayName}</Text>
                    <TouchableOpacity
                      onPress={() => runAction(f.userId, async () => {
                        await inviteFriendStreak(f.userId);
                      })}
                      disabled={busyId === f.userId}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}
                    >
                      {busyId === f.userId ? <ActivityIndicator color={colors.textInverse} /> : (
                        <>
                          <UserPlus size={15} color={colors.textInverse} />
                          <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: colors.textInverse }}>Einladen</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Empty state */}
            {active.length === 0 && toAccept.length === 0 && sent.length === 0 && invitable.length === 0 ? (
              <View style={{ alignItems: "center", gap: spacing.md, marginTop: 40 }}>
                <Users size={40} color={colors.textTertiary} />
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text, textAlign: "center" }}>
                  Noch keine Freunde
                </Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
                  Füge zuerst Freunde hinzu, dann könnt ihr gemeinsam einen Streak halten.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
