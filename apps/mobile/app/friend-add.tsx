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
import { ArrowLeft, Copy, Gift, Share2, UserPlus, Zap } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useColors, spacing, radius, typography } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { getReferralInfo, addFriendByCode, isApiError } from "../src/lib/api";

// One screen for "add a friend by code" — creates the friendship AND grants the
// one-time referral LP bonus, replacing the old separate "Empfehlung einlösen"
// screen. Inviting an already-added friend to a shared streak lives elsewhere
// (the Freunde-Streak area).
export default function FriendAddScreen() {
  const router = useRouter();
  const colors = useColors();
  const userId = useSessionStore((s) => s.userId);
  const setUsage = useUsageStore((s) => s.setUsage);

  const [myCode, setMyCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [lpFromReferrals, setLpFromReferrals] = useState(0);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadInfo = useCallback(() => {
    if (!userId) return;
    getReferralInfo()
      .then((r) => {
        setMyCode(r.referralCode);
        setReferredCount(r.referredCount);
        setLpFromReferrals(r.lpEarnedFromReferrals);
      })
      .catch(() => { /* code just stays hidden */ });
  }, [userId]);

  useEffect(() => { loadInfo(); }, [loadInfo]);

  const copyCode = useCallback(async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [myCode]);

  const share = useCallback(async () => {
    if (!myCode) return;
    try {
      await Share.share({
        message: `Füge mich auf clearn hinzu, dann halten wir einen gemeinsamen Lern-Streak und bekommen beide LP! Mein Code: ${myCode}`,
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
      if (res.lpGranted > 0 && res.newBalance != null) {
        setUsage({ lpBalance: res.newBalance });
      }
      const lpNote = res.lpGranted > 0 ? ` Ihr habt beide LP bekommen (+${res.lpGranted} für dich).` : "";
      // Laras Regel (#498): Wortform nach gespeichertem Geschlecht, bei Divers
      // oder fehlender Angabe die neutrale Form.
      const friendLine =
        res.friend.gender === "female"
          ? `${res.friend.displayName} ist jetzt deine Freundin.`
          : res.friend.gender === "male"
            ? `${res.friend.displayName} ist jetzt dein Freund.`
            : `${res.friend.displayName} lernt jetzt mit dir.`;
      Alert.alert(
        "Hinzugefügt",
        `${friendLine}${lpNote} Ihr könnt einen gemeinsamen Streak starten!`,
        [{ text: "Super", onPress: () => router.back() }]
      );
      loadInfo();
    } catch (err) {
      const message =
        isApiError(err) && err.code === "CODE_NOT_FOUND"
          ? "Diesen Code gibt es nicht."
          : isApiError(err) && err.code === "SELF_ADD"
            ? "Das ist dein eigener Code."
            : isApiError(err) && err.code === "INVALID_CODE"
              ? "Bitte gib einen gültigen Code ein."
              : "Hinzufügen fehlgeschlagen. Versuch es später noch einmal.";
      Alert.alert("Freund oder Freundin hinzufügen", message);
    } finally {
      setAdding(false);
    }
  }, [input, router, setUsage, loadInfo]);

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
            Freund oder Freundin hinzufügen
          </Text>
        </View>

        {/* LP bonus explainer */}
        <View
          style={{
            backgroundColor: colors.successLight ?? colors.surfaceSecondary,
            borderRadius: radius.lg,
            padding: spacing.lg,
            flexDirection: "row",
            gap: spacing.md,
          }}
        >
          <Gift size={22} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
              Zusammen lernen lohnt sich
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2, lineHeight: 20 }}>
              Fügst du einen Freund oder eine Freundin per Code hinzu, bekommt ihr beim ersten Mal LP: du 25, dein Freund oder deine Freundin 50 — und ihr könnt sofort einen Streak starten.
            </Text>
          </View>
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
          <View style={{ flexDirection: "row", gap: spacing.md, alignSelf: "stretch" }}>
            <TouchableOpacity
              onPress={copyCode}
              disabled={!myCode}
              activeOpacity={0.8}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
                backgroundColor: copied ? colors.successLight : colors.surfaceSecondary,
                borderRadius: radius.md, paddingVertical: spacing.md, opacity: myCode ? 1 : 0.5,
              }}
            >
              <Copy size={16} color={copied ? colors.success : colors.textSecondary} />
              <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: copied ? colors.success : colors.textSecondary }}>
                {copied ? "Kopiert" : "Kopieren"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={share}
              disabled={!myCode}
              activeOpacity={0.8}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
                backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
                opacity: myCode ? 1 : 0.5,
              }}
            >
              <Share2 size={16} color={colors.textInverse} />
              <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: colors.textInverse }}>
                Teilen
              </Text>
            </TouchableOpacity>
          </View>
          {referredCount > 0 || lpFromReferrals > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Zap size={13} color={colors.textTertiary} />
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>
                {referredCount} geworben · {lpFromReferrals} LP verdient
              </Text>
            </View>
          ) : null}
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
            Code eines Freundes oder einer Freundin eingeben
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
              borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
              padding: spacing.md, fontSize: typography.lg, letterSpacing: 2,
              color: colors.text, backgroundColor: colors.surface,
            }}
          />
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!canAdd}
            activeOpacity={0.8}
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
              backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md,
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
