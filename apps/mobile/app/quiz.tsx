import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trophy,
  RotateCcw,
  Timer,
  HelpCircle,
} from "lucide-react-native";
import { listCardsInDeck, type Card } from "../src/lib/api";
import {
  defaultQuizCopyDe,
  generateQuestions,
  type QuizQuestion,
} from "../src/lib/quizQuestions";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

export default function QuizScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();
  const router = useRouter();
  const quizCopy = useMemo(
    () => ({
      ...defaultQuizCopyDe,
      trueLabel: t("quiz.trueLabel", { defaultValue: defaultQuizCopyDe.trueLabel }),
      falseLabel: t("quiz.falseLabel", { defaultValue: defaultQuizCopyDe.falseLabel }),
      trueFalsePrompt: t("quiz.trueFalsePrompt", {
        defaultValue: defaultQuizCopyDe.trueFalsePrompt,
      }),
      imagePrompt: t("quiz.imagePrompt", { defaultValue: defaultQuizCopyDe.imagePrompt }),
    }),
    [t]
  );

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  const [timerEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load cards
  useEffect(() => {
    if (!deckId) return;
    (async () => {
      try {
        const { cards: fetched } = await listCardsInDeck(deckId);
        setCards(fetched);
        const q = generateQuestions(fetched, 10, quizCopy);
        setQuestions(q);
      } catch {
        // Error loading
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId, quizCopy]);

  // Timer
  useEffect(() => {
    if (!timerEnabled || finished || selected !== null) return;
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — treat as wrong
          if (timerRef.current) clearInterval(timerRef.current);
          setAnswers((a) => [...a, false]);
          setSelected(-1); // -1 = timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, timerEnabled, finished, selected]);

  const question = questions[currentIdx];
  const progress =
    questions.length > 0 ? (currentIdx + 1) / questions.length : 0;

  const handleSelect = (optionIdx: number) => {
    if (selected !== null) return; // Already answered
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(optionIdx);
    const isCorrect = optionIdx === question!.correctIndex;
    setAnswers((a) => [...a, isCorrect]);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
    }
  };

  const handleRestart = () => {
    const q = generateQuestions(cards, 10, quizCopy);
    setQuestions(q);
    setCurrentIdx(0);
    setSelected(null);
    setAnswers([]);
    setFinished(false);
  };

  const correctCount = answers.filter(Boolean).length;
  const scorePercent =
    answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Test",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
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

  if (questions.length < 2) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Test",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
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
            Mindestens 3 Karten nötig für den Test-Modus.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: spacing.xl,
              backgroundColor: colors.primary,
              paddingHorizontal: spacing.xxl,
              paddingVertical: 14,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: colors.textInverse, fontWeight: typography.bold }}>
              Zurück
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  // Results screen
  if (finished) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Ergebnis",
            headerBackTitle: "Zurück",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <ScrollView
            contentContainerStyle={{
              padding: spacing.xxl,
              gap: spacing.xl,
              alignItems: "center",
            }}
          >
            {/* Trophy */}
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor:
                  scorePercent >= 80
                    ? colors.successLight
                    : scorePercent >= 50
                    ? colors.warningLight
                    : colors.errorLight,
                justifyContent: "center",
                alignItems: "center",
                marginTop: spacing.xl,
              }}
            >
              <Trophy
                size={40}
                color={
                  scorePercent >= 80
                    ? colors.success
                    : scorePercent >= 50
                    ? colors.warning
                    : colors.error
                }
              />
            </View>

            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
              }}
            >
              {scorePercent}%
            </Text>

            <Text
              style={{
                fontSize: typography.lg,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              {correctCount} von {answers.length} richtig
            </Text>

            <Text
              style={{
                fontSize: typography.base,
                color: colors.textTertiary,
                textAlign: "center",
              }}
            >
              {scorePercent >= 80
                ? "Hervorragend! Du beherrschst den Stoff."
                : scorePercent >= 50
                ? "Gut! Etwas mehr Übung und du hast es drauf."
                : "Weiter üben! Wiederholung ist der Schlüssel."}
            </Text>

            {/* Answer summary */}
            <View style={{ width: "100%", gap: spacing.sm }}>
              {questions.map((q, i) => {
                const wasCorrect = answers[i];
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      backgroundColor: colors.surface,
                      padding: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: wasCorrect
                        ? colors.success + "40"
                        : colors.error + "40",
                    }}
                  >
                    {wasCorrect ? (
                      <CheckCircle2 size={20} color={colors.success} />
                    ) : (
                      <XCircle size={20} color={colors.error} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: typography.sm,
                          color: colors.text,
                          fontWeight: typography.medium,
                        }}
                        numberOfLines={1}
                      >
                        {q.type === "trueFalse"
                          ? q.tfPairing!.front
                          : q.questionText}
                      </Text>
                      {!wasCorrect && (
                        <Text
                          style={{
                            fontSize: typography.xs,
                            color: colors.success,
                            marginTop: 2,
                          }}
                        >
                          Richtig: {q.correctAnswer}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: spacing.md, width: "100%" }}>
              <TouchableOpacity
                onPress={handleRestart}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <RotateCcw size={18} color={colors.textInverse} />
                <Text
                  style={{
                    color: colors.textInverse,
                    fontWeight: typography.bold,
                  }}
                >
                  Nochmal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceSecondary,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: typography.bold,
                  }}
                >
                  Zurück
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Active quiz
  return (
    <>
      <Stack.Screen
        options={{
          title: deckTitle ?? "Test",
          headerBackTitle: "Abbrechen",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          {/* Progress */}
          <View style={{ gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  fontWeight: typography.medium,
                }}
              >
                Frage {currentIdx + 1} / {questions.length}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                {timerEnabled && selected === null && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Timer
                      size={14}
                      color={timeLeft <= 5 ? colors.error : colors.textSecondary}
                    />
                    <Text
                      style={{
                        fontSize: typography.sm,
                        fontWeight: typography.bold,
                        color: timeLeft <= 5 ? colors.error : colors.textSecondary,
                      }}
                    >
                      {timeLeft}s
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.success,
                    fontWeight: typography.semibold,
                  }}
                >
                  {correctCount} richtig
                </Text>
              </View>
            </View>
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

          {/* Question card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing.xxl,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadows.md,
              gap: spacing.lg,
            }}
          >
            {/* Badge */}
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor:
                  question!.type === "mc"
                    ? colors.primaryLight
                    : question!.type === "imageMc"
                    ? colors.infoLight
                    : colors.accentLight,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
              }}
            >
              <Text
                style={{
                  fontSize: typography.xs,
                  fontWeight: typography.bold,
                  color:
                    question!.type === "mc"
                      ? colors.primary
                      : question!.type === "imageMc"
                      ? colors.info
                      : colors.accent,
                }}
              >
                {question!.type === "mc"
                  ? t("quiz.mode.mc", { defaultValue: "MULTIPLE CHOICE" })
                  : question!.type === "imageMc"
                  ? t("quiz.mode.image", { defaultValue: "BILD QUIZ" })
                  : t("quiz.mode.tf", { defaultValue: "WAHR / FALSCH" })}
              </Text>
            </View>

            {/* Question text */}
            {question!.type === "trueFalse" && question!.tfPairing ? (
              <View style={{ gap: spacing.md }}>
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                  }}
                >
                  {question!.questionText}
                </Text>
                {question!.image ? (
                  <Image
                    source={{ uri: question!.image.url }}
                    style={{
                      width: "100%",
                      height: 180,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                    resizeMode="contain"
                  />
                ) : null}
                <View
                  style={{
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    gap: spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                      color: colors.text,
                    }}
                  >
                    {question!.tfPairing.front}
                  </Text>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                    }}
                  >
                    = {question!.tfPairing.back}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                {question!.image ? (
                  <Image
                    source={{ uri: question!.image.url }}
                    style={{
                      width: "100%",
                      height: 190,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceSecondary,
                    }}
                    resizeMode="contain"
                  />
                ) : null}
                <Text
                  style={{
                    fontSize: typography.xl,
                    fontWeight: typography.semibold,
                    color: colors.text,
                    lineHeight: 28,
                  }}
                >
                  {question!.questionText}
                </Text>
              </View>
            )}
          </View>

          {/* Options */}
          <View style={{ gap: spacing.sm }}>
            {question!.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrect = i === question!.correctIndex;
              const showResult = selected !== null;

              let bgColor: string = colors.surface;
              let borderColor: string = colors.border;
              let textColor: string = colors.text;

              if (showResult) {
                if (isCorrect) {
                  bgColor = colors.successLight;
                  borderColor = colors.success;
                  textColor = colors.success;
                } else if (isSelected && !isCorrect) {
                  bgColor = colors.errorLight;
                  borderColor = colors.error;
                  textColor = colors.error;
                }
              } else if (isSelected) {
                bgColor = colors.primaryLight;
                borderColor = colors.primary;
              }

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSelect(i)}
                  disabled={selected !== null}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: bgColor,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    borderWidth: 2,
                    borderColor,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  {/* Letter badge */}
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: showResult
                        ? isCorrect
                          ? colors.success
                          : isSelected
                          ? colors.error
                          : colors.surfaceSecondary
                        : colors.surfaceSecondary,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {showResult && isCorrect ? (
                      <CheckCircle2 size={18} color={colors.textInverse} />
                    ) : showResult && isSelected ? (
                      <XCircle size={18} color={colors.textInverse} />
                    ) : (
                      <Text
                        style={{
                          fontSize: typography.sm,
                          fontWeight: typography.bold,
                          color: colors.textSecondary,
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: typography.base,
                      fontWeight: isSelected
                        ? typography.semibold
                        : typography.normal,
                      color: textColor,
                    }}
                    numberOfLines={3}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Next button (after answering) */}
          {selected !== null && (
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              <Text
                style={{
                  color: colors.textInverse,
                  fontSize: typography.lg,
                  fontWeight: typography.bold,
                }}
              >
                {currentIdx + 1 >= questions.length ? "Ergebnis" : "Weiter"}
              </Text>
              <ArrowRight size={18} color={colors.textInverse} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}
