import { useEffect, useState } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Trophy,
  HelpCircle,
  Check,
  Pencil,
} from "lucide-react-native";
import { listCardsInDeck, type Card } from "../src/lib/api";
import { summarizeCardMedia } from "../src/lib/cardMedia";
import { isAnswerCorrect } from "../src/lib/answerCheck";
import { cleanTerm } from "../src/lib/cardTerms";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

interface Prompt {
  prompt: string;
  answer: string;
  isCloze: boolean;
}

// Build the "gap to fill" from a card:
//   - cloze cards ({{cN::x}}): show the sentence with a blank, answer is x
//     (the blank is fixed in the text, so direction has no effect)
//   - basic cards: show one side, type the other. `reverse` swaps which side.
function buildPrompt(card: Card, reverse: boolean): Prompt {
  const media = summarizeCardMedia(card);
  const rawFront = (media.plainFront || card.front || "").trim();
  const rawBack = (media.plainBack || card.back || "").trim();

  const match = rawFront.match(/\{\{c\d+::(.+?)\}\}/);
  if (match) {
    const answer = (match[1] ?? "").trim();
    const prompt = rawFront.replace(/\{\{c\d+::.+?\}\}/g, "______");
    return { prompt, answer, isCloze: true };
  }
  // Strip a translation-question wrapper so vocab cards behave as clean pairs.
  const front = cleanTerm(rawFront);
  const back = cleanTerm(rawBack);
  if (reverse) {
    return { prompt: back, answer: front, isCloze: false };
  }
  return { prompt: front, answer: back, isCloze: false };
}

// A card is usable if it has something to type in whichever direction is chosen.
function hasTypeable(card: Card): boolean {
  const parsed = buildPrompt(card, false);
  if (parsed.isCloze) return parsed.answer.length > 0;
  const media = summarizeCardMedia(card);
  const front = (media.plainFront || card.front || "").trim();
  const back = (media.plainBack || card.back || "").trim();
  return front.length > 0 && back.length > 0;
}

type Phase = "setup" | "play" | "summary";

export default function ClozeScreen() {
  const colors = useColors();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings chosen on the setup screen
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);

  const [phase, setPhase] = useState<Phase>("setup");
  const [round, setRound] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  // One result slot per card in the round (null = not answered yet), so the
  // back button can show an earlier card in its answered state.
  const [results, setResults] = useState<
    ({ input: string; correct: boolean; overridden: boolean } | null)[]
  >([]);

  const startRound = (cardsForRound: Card[]) => {
    setRound(cardsForRound);
    setResults(new Array(cardsForRound.length).fill(null));
    setIdx(0);
    setInput("");
    setPhase("play");
  };

  useEffect(() => {
    if (!deckId) return;
    (async () => {
      try {
        const { cards: fetched } = await listCardsInDeck(deckId);
        const usable = fetched.filter(hasTypeable);
        setAllCards(usable);
      } catch {
        // Error — falls through to the "no cards" state below.
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId]);

  const current = round[idx];
  const parsed = current ? buildPrompt(current, reverse) : null;

  // Derived view state of the card on screen.
  const currentResult = results[idx] ?? null;
  const revealed = currentResult !== null;
  const wasCorrect = currentResult
    ? currentResult.correct || currentResult.overridden
    : false;
  const displayedInput = currentResult ? currentResult.input : input;

  const setResultAt = (
    i: number,
    value: { input: string; correct: boolean; overridden: boolean } | null
  ) => {
    setResults((prev) => prev.map((r, j) => (j === i ? value : r)));
  };

  const handleCheck = () => {
    if (revealed || !current || !parsed) return;
    const correct = isAnswerCorrect(input, parsed.answer, { strict });
    setResultAt(idx, { input, correct, overridden: false });
  };

  // "Weiß ich nicht": reveal the answer, count it wrong (goes to the retry pile).
  const handleDontKnow = () => {
    if (revealed || !current) return;
    setResultAt(idx, { input, correct: false, overridden: false });
  };

  // Self-graded override: the learner decides a wrong-marked answer counts —
  // also retroactively when navigating back to an earlier card.
  const handleOverride = () => {
    if (!currentResult || wasCorrect) return;
    setResultAt(idx, { ...currentResult, overridden: true });
  };

  const handleNext = () => {
    if (idx + 1 >= round.length) {
      setPhase("summary");
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
  };

  const handleBack = () => {
    if (idx === 0) return;
    setIdx((i) => i - 1);
    setInput("");
  };

  // Round outcome, derived from the per-card results.
  const correctCount = results.filter(
    (r) => r && (r.correct || r.overridden)
  ).length;
  const wrong = round.filter((card, i) => {
    const r = results[i];
    return r != null && !(r.correct || r.overridden);
  });

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

  // Setup — choose strict checking and which side is asked
  if (phase === "setup") {
    const leftSide = reverse ? "Rückseite" : "Vorderseite";
    const rightSide = reverse ? "Vorderseite" : "Rückseite";

    return (
      <>
        {screenHeader(deckTitle ?? "Lückentext")}
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              padding: spacing.xl,
              gap: spacing.xl,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Intro */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.lg }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: colors.warningLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Pencil size={32} color={colors.warning} />
              </View>
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.bold,
                  color: colors.text,
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {deckTitle ?? "Lückentext"}
              </Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
                Antwort eintippen
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              {/* Genau prüfen toggle */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    Genau prüfen
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {strict
                      ? "Groß/klein und Akzente zählen"
                      : "Verzeiht Groß/klein, Akzente, kleine Tippfehler"}
                  </Text>
                </View>
                <Switch
                  value={strict}
                  onValueChange={setStrict}
                  trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.surfaceSecondary}
                />
              </View>

              {/* Direction — one arrow in the middle, tap to swap */}
              <TouchableOpacity
                onPress={() => setReverse((r) => !r)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  ...shadows.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    marginBottom: spacing.md,
                  }}
                >
                  Abgefragte Richtung
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{
                      flex: 1,
                      textAlign: "right",
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    {leftSide}
                  </Text>
                  <View style={{ width: 44, alignItems: "center" }}>
                    <ArrowRight size={22} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      textAlign: "left",
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                      color: colors.text,
                    }}
                  >
                    {rightSide}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textTertiary,
                    textAlign: "center",
                    marginTop: spacing.md,
                  }}
                >
                  Tippen zum Tauschen
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />

            {/* Start */}
            <TouchableOpacity
              onPress={() => startRound(allCards)}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Text
                style={{
                  color: colors.textInverse,
                  fontWeight: typography.bold,
                  fontSize: typography.lg,
                }}
              >
                Starten
              </Text>
            </TouchableOpacity>
          </ScrollView>
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

              <TouchableOpacity
                onPress={() => setPhase("setup")}
                activeOpacity={0.85}
                style={{
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  Einstellungen
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
              value={displayedInput}
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

            {/* Feedback after checking — the solution word always shows,
                whether right or wrong. */}
            {revealed && (
              <View style={{ gap: spacing.sm }}>
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
                      {wasCorrect ? "Richtig" : "Falsch"}
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.base,
                        color: colors.text,
                        marginTop: 2,
                      }}
                    >
                      Lösung: {parsed?.answer}
                    </Text>
                  </View>
                </View>

                {/* Let the learner overrule a strict "wrong" themselves */}
                {!wasCorrect && (
                  <TouchableOpacity
                    onPress={handleOverride}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing.sm,
                      paddingVertical: 12,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.success,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Check size={18} color={colors.success} />
                    <Text
                      style={{
                        color: colors.success,
                        fontWeight: typography.semibold,
                        fontSize: typography.base,
                      }}
                    >
                      Trotzdem als richtig zählen
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Action row: back to the previous card + check/next. Earlier
                cards show their stored answer; the override stays available. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <TouchableOpacity
                onPress={handleBack}
                disabled={idx === 0}
                activeOpacity={0.7}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: radius.full ?? 999,
                  backgroundColor: colors.surfaceSecondary,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: idx === 0 ? 0.3 : 1,
                }}
              >
                <ArrowLeft size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              {!revealed ? (
                <>
                  <TouchableOpacity
                    onPress={handleCheck}
                    disabled={input.trim().length === 0}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
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
                  <TouchableOpacity
                    onPress={handleDontKnow}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      paddingVertical: 15,
                      borderRadius: radius.md,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontWeight: typography.bold,
                        fontSize: typography.base,
                      }}
                    >
                      Weiß ich nicht
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleNext}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
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
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}
