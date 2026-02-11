import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessionStore } from "../../src/store/sessionStore";
import { listDecks, type Deck } from "../../src/lib/api";
import { searchDecks } from "../../src/lib/searchDecks";

export default function DecksScreen() {
  const userId = useSessionStore((state) => state.userId);
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDecks = useCallback(async () => {
    if (!userId) return;
    try {
      const { decks: fetched } = await listDecks(userId);
      setDecks(fetched);
    } catch {
      // Silently fail, show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDecks();
  };

  const filtered = useMemo(() => searchDecks(decks, query), [decks, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Decks</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Deck suchen..."
          placeholderTextColor="#9ca3af"
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: "#fff",
          }}
        />
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#111827" />
          </View>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          >
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
                <Text style={{ fontSize: 40 }}>📚</Text>
                <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center" }}>
                  {decks.length === 0
                    ? "Noch keine Decks.\nScanne einen Text, um dein erstes Deck zu erstellen."
                    : "Kein Deck gefunden."}
                </Text>
              </View>
            ) : (
              filtered.map((deck) => (
                <View
                  key={deck.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <Text style={{ fontWeight: "600", fontSize: 16 }}>{deck.title}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    {deck.tags.map((tag) => (
                      <Text
                        key={tag}
                        style={{
                          fontSize: 12,
                          backgroundColor: "#f3f4f6",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          color: "#6b7280",
                        }}
                      >
                        {tag}
                      </Text>
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                    {new Date(deck.createdAt).toLocaleDateString("de")}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
