import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReviewSession, type ReviewRating } from "../../src/features/review/reviewSession";
import { useSessionStore } from "../../src/store/sessionStore";
import { getDueCards, reviewCard } from "../../src/lib/api";

export default function LearnScreen() {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const { cards, index, revealed, completed, start, reveal, rateCurrent } = useReviewSession();
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const loadDueCards = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { cards: due } = await getDueCards(userId);
      if (due.length > 0) {
        start(due.map((c) => ({ id: c.id, front: c.front, back: c.back })));
      } else {
        start([]);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Fehler";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }, [userId, start]);

  useEffect(() => {
    // Only load due cards if no cards are already loaded (e.g. from scan flow)
    if (cards.length === 0 && !completed) {
      loadDueCards();
    }
  }, []);

  const handleRate = async (rating: ReviewRating) => {
    const result = rateCurrent(rating);
    if (!result || !userId) return;

    setReviewLoading(true);
    setLastResult(null);
    try {
      const res = await reviewCard(userId, result.cardId, rating);
      setLastResult(`→ ${res.state} | nächste Fälligkeit: ${new Date(res.nextDueAt).toLocaleDateString("de")}`);
    } catch {
      // Review is still tracked locally, API sync can happen later
      setLastResult("Offline gespeichert");
    } finally {
      setReviewLoading(false);
    }
  };

  const current = cards[index];
  const remaining = Math.max(cards.length - index, 0);

  // Parse cloze cards: replace {{c1::answer}} with ___ on front, extract answer for back
  const formatCloze = (text: string): { display: string; clozeAnswer: string | null } => {
    const match = text.match(/\{\{c\d+::(.+?)\}\}/);
    if (!match) return { display: text, clozeAnswer: null };
    const clozeAnswer = match[1];
    const display = text.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { display, clozeAnswer };
  };

  const frontParsed = current ? formatCloze(current.front) : { display: "", clozeAnswer: null };
  const displayBack = frontParsed.clozeAnswer ?? current?.back ?? "";

  const ratingButton = (label: string, rating: ReviewRating, color: string) => (
    <TouchableOpacity
      onPress={() => handleRate(rating)}
      disabled={reviewLoading}
      style={{
        flex: 1,
        backgroundColor: color,
        borderRadius: 10,
        padding: 14,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>{t("reviewHeadline")}</Text>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={{ marginTop: 12, color: "#6b7280" }}>Fällige Karten laden...</Text>
          </View>
        ) : completed || cards.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16 }}>
            <Text style={{ fontSize: 48 }}>🎉</Text>
            <Text style={{ fontSize: 18, fontWeight: "600", textAlign: "center" }}>
              {cards.length === 0 ? "Keine fälligen Karten" : "Session abgeschlossen!"}
            </Text>
            <Text style={{ color: "#6b7280", textAlign: "center" }}>
              {cards.length === 0
                ? "Scanne einen Text, um Flashcards zu generieren."
                : `${cards.length} Karten gelernt.`}
            </Text>
            <TouchableOpacity
              onPress={loadDueCards}
              style={{
                backgroundColor: "#111827",
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 14,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Neu laden</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1, gap: 16 }}>
            {/* Progress */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#6b7280" }}>
                Karte {index + 1} von {cards.length}
              </Text>
              <Text style={{ color: "#6b7280" }}>Noch {remaining}</Text>
            </View>

            {/* Card */}
            <View
              style={{
                flex: 1,
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 24,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "600",
                  textAlign: "center",
                  marginBottom: revealed ? 24 : 0,
                }}
              >
                {frontParsed.display}
              </Text>
              {revealed && (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#e5e7eb",
                      width: "100%",
                      marginBottom: 24,
                    }}
                  />
                  <Text style={{ fontSize: 17, color: "#374151", textAlign: "center", fontWeight: frontParsed.clozeAnswer ? "700" : "400" }}>
                    {displayBack}
                  </Text>
                </>
              )}
            </View>

            {/* Last result */}
            {lastResult && (
              <Text style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                {lastResult}
              </Text>
            )}

            {/* Actions */}
            {!revealed ? (
              <TouchableOpacity
                onPress={reveal}
                style={{
                  backgroundColor: "#111827",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                  Antwort anzeigen
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {ratingButton("Nochmal", "again", "#ef4444")}
                {ratingButton("Schwer", "hard", "#f59e0b")}
                {ratingButton("Gut", "good", "#22c55e")}
                {ratingButton("Leicht", "easy", "#3b82f6")}
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
