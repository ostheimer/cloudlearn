import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
  HelpCircle,
} from "lucide-react-native";
import { listCardsInDeck, type Card } from "../src/lib/api";
import { summarizeCardMedia } from "../src/lib/cardMedia";
import { isAnswerCorrect } from "../src/lib/answerCheck";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

interface Prompt {
  prompt: string;
  answer: string;
  isCloze: boolean;
}

// Build the "gap to fill" from a card:
//   - cloze cards ({{cN::x}}): show the sentence with a blank, answer is x
//   - basic cards: show the front, the answer is the back
function buildPrompt(card: Card): Prompt {
  const media = summarizeCardMedia(card);
  const front = (media.plainFront || card.front || "").trim();
  const back = (media.plainBack || card.back || "").trim();

  const match = front.match(/\{\{c\d+::(.+?)\}\}/);
  if (match) {
    const answer = (match[1] ?? "").trim();
    const prompt = front.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { prompt, answer, isCloze: true };
  }
  return { prompt: front, answer: back, isCloze: false };
}

type Phase = "play" | "summary";

export default function ClozeScreen() {
  const colors = useColors();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();
  const router = useRouter();

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const [round, setRound] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [wrong, setWrong] = useState<Card[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("play");

  const startRound = (cardsForRound: Card[]) => {
    setRound(cardsForRound);
    setIdx(0);
    setInput("");
    setRevealed(false);
    setWasCorrect(false);
    setWrong([]);
    setCorrectCount(0);
    setPhase("play");
  };

  useEffect(() => {
    if (!deckId) return;
    (async () => {
      try {
        const { cards: fetched } = await listCardsInDeck(deckId);
        // Only cards that actually have something to type.
        const usable = fetched.filter((c) => buildPrompt(c).answer.length > 0);
        setAllCards(usable);
        setRound(usable);
      } catch {
        // Error — falls through to the "no cards" state below.
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId]);

  const current = round[idx];
  const parsed = current ? buildPrompt(current) : null;

  const handleCheck = () => {
    if (revealed || !current || !parsed) return;
    const correct = isAnswerCorrect(input, parsed.answer);
    setWasCorrect(correct);
    setRevealed(true);
    if (correct) {
      setCorrectCount((c) => c + 1);
    } else {
      setWrong((w) => [...w, current]);
    }
  };

  const handleNext = () => {
    if (idx + 1 >= round.length) {
      setPhase("summary");
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
    setRevealed(false);
    setWasCorrect(false);
  };

  const screenHeader = (title: string) => (
    <Stack.Screen
      options={{
        title,
        headerBackTitle: "Zurück",
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    />
  );

  if (loading) {
    return (
      <>
        {screenHeader("Lückentext")}
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      </>
    );
  }

  if (allCards.length === 0) {
    return (
      <>
        {screenHeader("Lückentext")}
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.background,
            padding: spacing.xxl,
          }}
        >
          <HelpCircle size={48} color={colors.textTertiary} />
          <Text
            style={{
              marginTop: spacing.lg,
              fontSize: typography.lg,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            Dieses Deck hat keine Karten, bei denen man etwas eintippen kann.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // Summary
  if (phase === "summary") {
    const total = round.length;
    const correct = correctCount;
    const wrongCount = wrong.length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const allRight = wrongCount === 0;

    return (
      <>
        {screenHeader("Auswertung")}
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: spacing.xxl,
              gap: spacing.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: allRight ? colors.successLight : colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {allRight ? (
                <Trophy size={40} color={colors.success} />
              ) : (
                <CheckCircle2 size={40} color={colors.primary} />
              )}
            </View>

            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
              }}
            >
              {percent}%
            </Text>

            <Text style={{ fontSize: typography.lg, color: colors.textSecondary }}>
              {correct} von {total} richtig
            </Text>

            {allRight ? (
              <Text
                style={{
                  fontSize: typography.base,
                  color: colors.success,
                  fontWeight: typography.semibold,
                }}
              >
                Alles richtig — stark!
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: typography.base,
                  color: colors.textSecondary,
                  textAlign: "center",
                }}
              >
                {wrongCount} {wrongCount === 1 ? "Karte" : "Karten"} noch offen.
              </Text>
            )}

            <View style={{ width: "100%", gap: spacing.sm }}>
              {!allRight && (
                <TouchableOpacity
                  onPress={() => startRound(wrong)}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 14,
                    borderRadius: radius.md,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    ...shadows.sm,
                  }}
                >
                  <RotateCcw size={18} color={colors.textInverse} />
                  <Text
                    style={{ color: colors.textInverse, fontWeight: typography.bold }}
                  >
                    Falsche wiederholen ({wrongCount})
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => startRound(allCards)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: allRight ? colors.primary : colors.surface,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: allRight ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: allRight ? colors.textInverse : colors.text,
                    fontWeight: typography.bold,
                  }}
                >
                  Von vorne (alle {allCards.length})
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Playing
  const progress = round.length > 0 ? (idx + (revealed ? 1 : 0)) / round.length : 0;

  return (
    <>
      {screenHeader(deckTitle ?? "Lückentext")}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Progress */}
            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  fontWeight: typography.medium,
                  textAlign: "center",
                }}
              >
                {idx + 1} / {round.length}
              </Text>
              <View
                style={{
                  height: 4,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.max(progress * 100, 2)}%`,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>

            {/* Prompt card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.xl,
                gap: spacing.md,
                ...shadows.sm,
              }}
            >
              <Text
                style={{
                  fontSize: typography.xs,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {parsed?.isCloze ? "Ergänze die Lücke" : "Wie lautet die Antwort?"}
              </Text>
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.semibold,
                  color: colors.text,
                  lineHeight: 30,
                }}
              >
                {parsed?.prompt}
              </Text>
            </View>

            {/* Answer input */}
            <TextInput
              key={idx}
              value={input}
              onChangeText={setInput}
              editable={!revealed}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={handleCheck}
              placeholder="Antwort eintippen…"
              placeholderTextColor={colors.textTertiary}
              style={{
                borderWidth: 1.5,
                borderColor: !revealed
                  ? colors.border
                  : wasCorrect
                    ? colors.success
                    : colors.error,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: 14,
                fontSize: typography.lg,
                backgroundColor: colors.surface,
                color: colors.text,
              }}
            />

            {/* Feedback after checking */}
            {revealed && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  backgroundColor: wasCorrect ? colors.successLight : colors.errorLight,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                {wasCorrect ? (
                  <CheckCircle2 size={22} color={colors.success} />
                ) : (
                  <XCircle size={22} color={colors.error} />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.bold,
                      color: wasCorrect ? colors.success : colors.error,
                    }}
                  >
                    {wasCorrect ? "Richtig" : "Fast!"}
                  </Text>
                  {!wasCorrect && (
                    <Text
                      style={{
                        fontSize: typography.base,
                        color: colors.text,
                        marginTop: 2,
                      }}
                    >
                      Richtig ist: {parsed?.answer}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Action */}
            {!revealed ? (
              <TouchableOpacity
                onPress={handleCheck}
                disabled={input.trim().length === 0}
                activeOpacity={0.85}
                style={{
                  backgroundColor:
                    input.trim().length === 0 ? colors.surfaceSecondary : colors.primary,
                  paddingVertical: 15,
                  borderRadius: radius.md,
                  alignItems: "center",
                  ...shadows.sm,
                }}
              >
                <Text
                  style={{
                    color:
                      input.trim().length === 0 ? colors.textTertiary : colors.textInverse,
                    fontWeight: typography.bold,
                    fontSize: typography.base,
                  }}
                >
                  Prüfen
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 15,
                  borderRadius: radius.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  ...shadows.sm,
                }}
              >
                <Text
                  style={{
                    color: colors.textInverse,
                    fontWeight: typography.bold,
                    fontSize: typography.base,
                  }}
                >
                  {idx + 1 >= round.length ? "Zur Auswertung" : "Weiter"}
                </Text>
                <ArrowRight size={18} color={colors.textInverse} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}
