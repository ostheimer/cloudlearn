import { useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessionStore } from "../../src/store/sessionStore";
import { useOcrEditorState } from "../../src/features/ocr/ocrEditorState";
import { scanText, createDeck, createCard, type Flashcard } from "../../src/lib/api";
import { useReviewSession } from "../../src/features/review/reviewSession";

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const editedText = useOcrEditorState((state) => state.editedText);
  const setOriginalText = useOcrEditorState((state) => state.setOriginalText);
  const setEditedText = useOcrEditorState((state) => state.setEditedText);
  const startReview = useReviewSession((state) => state.start);

  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);

  const handleGenerateCards = async () => {
    if (!editedText.trim() || !userId) return;
    setLoading(true);
    setCards([]);
    setSaved(false);
    try {
      const result = await scanText(userId, editedText);
      setCards(result.cards);
      setModel(result.model);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndLearn = async () => {
    if (!userId || cards.length === 0) return;
    setLoading(true);
    try {
      // Create a deck for the generated cards
      const { deck } = await createDeck(userId, `Scan ${new Date().toLocaleDateString("de")}`, [
        "scan",
        "auto",
      ]);

      // Save each card to the deck
      const savedCards = [];
      for (const card of cards) {
        const { card: savedCard } = await createCard(userId, deck.id, card);
        savedCards.push(savedCard);
      }

      setSaved(true);

      // Start review session with the saved cards
      startReview(
        savedCards.map((c) => ({ id: c.id, front: c.front, back: c.back }))
      );

      Alert.alert(
        "Gespeichert!",
        `${savedCards.length} Karten in "${deck.title}" gespeichert.`,
        [{ text: "Jetzt lernen", onPress: () => router.push("/(tabs)/learn") }]
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler beim Speichern", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>{t("captureHeadline")}</Text>

        {/* Text input area */}
        <View>
          <Text style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
            Text eingeben oder einfügen:
          </Text>
          <TextInput
            multiline
            value={editedText}
            onChangeText={setEditedText}
            placeholder="Tippe oder füge hier deinen Lerntext ein..."
            placeholderTextColor="#9ca3af"
            style={{
              minHeight: 150,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              backgroundColor: "#fff",
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Example text button */}
        {!editedText && (
          <TouchableOpacity
            onPress={() =>
              setOriginalText(
                "Die Mitochondrien sind das Kraftwerk der Zelle. Sie erzeugen ATP durch oxidative Phosphorylierung. Die innere Membran ist stark gefaltet und bildet die Cristae."
              )
            }
            style={{
              backgroundColor: "#e5e7eb",
              borderRadius: 10,
              padding: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#374151", fontWeight: "500" }}>Beispieltext laden</Text>
          </TouchableOpacity>
        )}

        {/* Generate button */}
        <TouchableOpacity
          onPress={handleGenerateCards}
          disabled={loading || !editedText.trim()}
          style={{
            backgroundColor: loading || !editedText.trim() ? "#9ca3af" : "#111827",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              Flashcards generieren
            </Text>
          )}
        </TouchableOpacity>

        {/* Generated cards */}
        {cards.length > 0 && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
              {cards.length} Karten generiert (via {model})
            </Text>
            {cards.map((card, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              >
                <Text style={{ fontWeight: "600", fontSize: 15, marginBottom: 6 }}>
                  {card.front}
                </Text>
                <Text style={{ color: "#4b5563", fontSize: 14 }}>{card.back}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      backgroundColor: "#f3f4f6",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      color: "#6b7280",
                    }}
                  >
                    {card.type}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      backgroundColor: "#f3f4f6",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      color: "#6b7280",
                    }}
                  >
                    {card.difficulty}
                  </Text>
                </View>
              </View>
            ))}

            {/* Save and learn button */}
            {!saved && (
              <TouchableOpacity
                onPress={handleSaveAndLearn}
                disabled={loading}
                style={{
                  backgroundColor: "#059669",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                    Speichern & Lernen
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
