import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { i18n } from "../../src/i18n";
import { useSessionStore } from "../../src/store/sessionStore";
import { getSubscriptionStatus } from "../../src/lib/api";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const email = useSessionStore((state) => state.email);
  const signOut = useSessionStore((state) => state.signOut);
  const [tier, setTier] = useState("...");

  useEffect(() => {
    if (!userId) return;
    getSubscriptionStatus(userId)
      .then((res) => setTier(res.status.tier))
      .catch(() => setTier("unbekannt"));
  }, [userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ flex: 1, gap: 16, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>{t("profileTab")}</Text>

        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: "#6b7280" }}>E-Mail</Text>
          <Text style={{ fontSize: 15, fontWeight: "500" }}>{email ?? "—"}</Text>
          <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>Abo-Stufe</Text>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>
            {tier === "free" ? "Free" : tier === "pro" ? "Pro" : tier}
          </Text>
        </View>

        <Text style={{ fontSize: 16, fontWeight: "600" }}>Sprache</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => void i18n.changeLanguage("de")}
            style={{
              flex: 1,
              backgroundColor: i18n.language === "de" ? "#111827" : "#e5e7eb",
              borderRadius: 10,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: i18n.language === "de" ? "#fff" : "#111827",
                fontWeight: "600",
              }}
            >
              Deutsch
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void i18n.changeLanguage("en")}
            style={{
              flex: 1,
              backgroundColor: i18n.language === "en" ? "#111827" : "#e5e7eb",
              borderRadius: 10,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: i18n.language === "en" ? "#fff" : "#111827",
                fontWeight: "600",
              }}
            >
              English
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        {/* Sign out button */}
        <TouchableOpacity
          onPress={signOut}
          style={{
            backgroundColor: "#ef4444",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {t("signOut")}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          clearn.ai v0.1.0 — API: clearn-api.vercel.app
        </Text>
      </View>
    </SafeAreaView>
  );
}
