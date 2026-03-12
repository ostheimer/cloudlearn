import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Copy,
  Gift,
  Share2,
  Users,
  Zap,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";
import { useUsageStore } from "../src/store/usageStore";
import { getReferralInfo, claimReferralCode } from "../src/lib/api";

export default function ReferralScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const setUsage = useUsageStore((s) => s.setUsage);
  const lpBalance = useUsageStore((s) => s.lpBalance);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredCount, setReferredCount] = useState(0);
  const [lpFromReferrals, setLpFromReferrals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inputCode, setInputCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadInfo = useCallback(async () => {
    try {
      const info = await getReferralInfo();
      setReferralCode(info.referralCode);
      setReferredCount(info.referredCount);
      setLpFromReferrals(info.lpEarnedFromReferrals);
    } catch { /* best-effort */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadInfo(); }, [loadInfo]);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    await Share.share({
      message: t("referral.shareMessage", { code: referralCode }),
    });
  };

  const handleClaimCode = async () => {
    const code = inputCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      Alert.alert(t("referral.invalidCode"));
      return;
    }
    setClaiming(true);
    try {
      const result = await claimReferralCode(code);
      setUsage({ lpBalance: result.newBalance });
      Alert.alert(
        t("referral.claimSuccess"),
        t("referral.claimSuccessBody", { lp: result.lpGranted, balance: result.newBalance })
      );
      setInputCode("");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "ALREADY_REFERRED") {
        Alert.alert(t("referral.alreadyReferred"));
      } else if (code === "CODE_NOT_FOUND") {
        Alert.alert(t("referral.codeNotFound"));
      } else if (code === "SELF_REFERRAL") {
        Alert.alert(t("referral.selfReferral"));
      } else {
        Alert.alert(t("referral.claimError"));
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            {t("referral.title")}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* LP reward explainer banner */}
            <View style={{
              backgroundColor: colors.successLight ?? colors.surfaceSecondary,
              borderRadius: radius.xl,
              padding: spacing.xl,
              gap: spacing.sm,
              ...shadows.sm,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Gift size={24} color={colors.success} />
                <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                  {t("referral.bonusTitle")}
                </Text>
              </View>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary, lineHeight: 22 }}>
                {t("referral.bonusDesc", { sender: 50, receiver: 25 })}
              </Text>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
                padding: spacing.lg, alignItems: "center", gap: spacing.xs,
                borderWidth: 1, borderColor: colors.border,
              }}>
                <Users size={20} color={colors.primary} />
                <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>
                  {referredCount}
                </Text>
                <Text style={{ fontSize: typography.xs, color: colors.textSecondary, textAlign: "center" }}>
                  {t("referral.statUsers")}
                </Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
                padding: spacing.lg, alignItems: "center", gap: spacing.xs,
                borderWidth: 1, borderColor: colors.border,
              }}>
                <Zap size={20} color={colors.warning} fill={colors.warning} />
                <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>
                  {lpFromReferrals}
                </Text>
                <Text style={{ fontSize: typography.xs, color: colors.textSecondary, textAlign: "center" }}>
                  {t("referral.statLp")}
                </Text>
              </View>
            </View>

            {/* Your code */}
            {referralCode && (
              <View style={{
                backgroundColor: colors.surface, borderRadius: radius.lg,
                padding: spacing.lg, gap: spacing.md,
                borderWidth: 1, borderColor: colors.border, ...shadows.sm,
              }}>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium }}>
                  {t("referral.yourCode")}
                </Text>
                <View style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
                  padding: spacing.lg, alignItems: "center",
                }}>
                  <Text style={{
                    fontSize: typography.xxl,
                    fontWeight: typography.extrabold,
                    color: colors.primary,
                    letterSpacing: 6,
                    fontVariant: ["tabular-nums"],
                  }}>
                    {referralCode}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <TouchableOpacity
                    onPress={() => { void handleCopyCode(); }}
                    activeOpacity={0.8}
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: spacing.sm, backgroundColor: copied ? colors.successLight : colors.surfaceSecondary,
                      borderRadius: radius.md, paddingVertical: spacing.md,
                    }}
                  >
                    <Copy size={16} color={copied ? colors.success : colors.textSecondary} />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: copied ? colors.success : colors.textSecondary }}>
                      {copied ? t("referral.copied") : t("referral.copy")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { void handleShare(); }}
                    activeOpacity={0.8}
                    style={{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      gap: spacing.sm, backgroundColor: colors.primary,
                      borderRadius: radius.md, paddingVertical: spacing.md,
                    }}
                  >
                    <Share2 size={16} color="#fff" />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.semibold, color: "#fff" }}>
                      {t("referral.share")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Redeem a friend's code */}
            <View style={{
              backgroundColor: colors.surface, borderRadius: radius.lg,
              padding: spacing.lg, gap: spacing.md,
              borderWidth: 1, borderColor: colors.border, ...shadows.sm,
            }}>
              <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>
                {t("referral.redeemTitle")}
              </Text>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                {t("referral.redeemDesc", { lp: 25 })}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <TextInput
                  value={inputCode}
                  onChangeText={(v) => setInputCode(v.toUpperCase())}
                  placeholder={t("referral.codePlaceholder")}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="characters"
                  maxLength={16}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    color: colors.text,
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                    letterSpacing: 2,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />
                <TouchableOpacity
                  onPress={() => { void handleClaimCode(); }}
                  disabled={claiming || inputCode.trim().length < 4}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: inputCode.trim().length < 4 ? colors.surfaceSecondary : colors.primary,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.lg,
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 80,
                  }}
                >
                  {claiming ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: typography.bold, fontSize: typography.sm }}>
                      {t("referral.redeem")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
