import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, listDecks } from "../../src/lib/api";

export default function HomeScreen() {
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const [dueCount, setDueCount] = useState(0);
  const [deckCount, setDeckCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    Promise.all([
      getDueCards(userId).catch(() => ({ cards: [] })),
      listDecks(userId).catch(() => ({ decks: [] })),
    ])
      .then(([dueRes, deckRes]) => {
        setDueCount(dueRes.cards.length);
        setDeckCount(deckRes.decks.length);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ flex: 1, padding: 20, gap: 20 }}>
        <View style={{ paddingTop: 20 }}>
          <Text style={{ fontSize: 32, fontWeight: "800", color: "#111827" }}>clearn</Text>
          <Text style={{ fontSize: 16, color: "#6b7280", marginTop: 4 }}>
            Foto → Karte → Wissen
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#111827" style={{ marginTop: 40 }} />
        ) : (
          <>
            {error ? (
              <Text style={{ color: "red" }}>{error}</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 36, fontWeight: "800", color: "#111827" }}>
                  {dueCount}
                </Text>
                <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                  Fällige Karten
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 36, fontWeight: "800", color: "#111827" }}>
                  {deckCount}
                </Text>
                <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Decks</Text>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              {dueCount > 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/learn")}
                  style={{
                    backgroundColor: "#111827",
                    borderRadius: 14,
                    padding: 18,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                    {dueCount} Karten lernen
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/scan")}
                style={{
                  backgroundColor: dueCount > 0 ? "#fff" : "#111827",
                  borderRadius: 14,
                  padding: 18,
                  alignItems: "center",
                  borderWidth: dueCount > 0 ? 1 : 0,
                  borderColor: "#d1d5db",
                }}
              >
                <Text
                  style={{
                    color: dueCount > 0 ? "#111827" : "#fff",
                    fontSize: 17,
                    fontWeight: "700",
                  }}
                >
                  Neuen Text scannen
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
