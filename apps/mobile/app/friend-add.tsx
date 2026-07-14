import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Share2, UserPlus } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";
import { getReferralInfo, addFriendByCode, isApiError } from "../src/lib/api";

export default function FriendAddScreen() {
  const router = useRouter();
  const colors = useColors();
  const userId = useSessionStore((s) => s.userId);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getReferralInfo()
      .then((r) => setMyCode(r.referralCode))
      .catch(() => { /* code just stays hidden */ });
  }, [userId]);

  const share = useCallback(async () => {
    if (!myCode) return;
    try {
      await Share.share({
        message: `Füge mich auf clearn hinzu, dann halten wir einen gemeinsamen Lern-Streak! Mein Code: ${myCode}`,
      });
    } catch {
      // user cancelled the share sheet
    }
  }, [myCode]);

  const handleAdd = useCallback(async () => {
    const code = input.trim().toUpperCase();
    if (code.length < 4) return;
    setAdding(true);
    try {
      const res = await addFriendByCode(code);
      setInput("");
      Alert.alert(
        "Freund hinzugefügt",
        `${res.friend.displayName} ist jetzt dein Freund. Ihr könnt einen gemeinsamen Streak starten!`,
        [{ text: "Super", onPress: () => router.back() }]
      );
    } catch (err) {
      const message =
        isApiError(err) && err.code === "CODE_NOT_FOUND"
          ? "Diesen Code gibt es nicht."
          : isApiError(err) && err.code === "SELF_ADD"
            ? "Das ist dein eigener Code."
            : isApiError(err) && err.code === "INVALID_CODE"
              ? "Bitte gib einen gültigen Code ein."
              : "Hinzufügen fehlgeschlagen. Versuch es später noch einmal.";
      Alert.alert("Freund hinzufügen", message);
    } finally {
      setAdding(false);
    }
  }, [input, router]);

  const canAdd = input.trim().length >= 4 && !adding;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.xl, gap: spacing.lg }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            Freund hinzufügen
          </Text>
        </View>

        {/* Your own share code */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Dein Freunde-Code</Text>
          {myCode ? (
            <Text style={{ fontSize: 28, fontWeight: typography.bold, letterSpacing: 3, color: colors.primary }}>
              {myCode}
            </Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          <TouchableOpacity
            onPress={share}
            disabled={!myCode}
            activeOpacity={0.8}
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              backgroundColor: colors.primaryLight,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              opacity: myCode ? 1 : 0.5,
            }}
          >
            <Share2 size={16} color={colors.primary} />
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.primary }}>
              Code teilen
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ fontSize: typography.sm, color: colors.textTertiary }}>oder</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Enter a friend's code */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
            Code einer Freundin eingeben
          </Text>
          <TextInput
            value={input}
            onChangeText={(t) => setInput(t.toUpperCase())}
            placeholder="z. B. 6CEFC7C1"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              fontSize: typography.lg,
              letterSpacing: 2,
              color: colors.text,
              backgroundColor: colors.surface,
            }}
          />
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!canAdd}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              opacity: canAdd ? 1 : 0.5,
            }}
          >
            {adding ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <UserPlus size={18} color={colors.textInverse} />
                <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.textInverse }}>
                  Hinzufügen
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
