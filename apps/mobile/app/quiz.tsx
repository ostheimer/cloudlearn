import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Trophy,
  RotateCcw,
  Timer,
  HelpCircle,
  Brain,
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
  const [loadError, setLoadError] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  // One slot per question (null = unanswered, -1 = timeout) so going back to a
  // previous question shows it in its answered state.
  const [selections, setSelections] = useState<(number | null)[]>([]);
  const [finished, setFinished] = useState(false);
  const [timerEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Setup choices (picked before the quiz starts)
  const [inSetup, setInSetup] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [typeMC, setTypeMC] = useState(true);
  const [typeTF, setTypeTF] = useState(true);
  const anyType = typeMC || typeTF;

  // Load cards
  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setCards(fetched);
    } catch {
      // Distinguish a load failure (offline / server error) from a deck that
      // genuinely has too few cards, so we can offer a retry instead.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const startQuiz = () => {
    if (!anyType) return;
    const q = generateQuestions(cards, 10, quizCopy, Math.random, {
      reverse,
      allowMc: typeMC,
      allowTrueFalse: typeTF,
    });
    if (q.length === 0) return;
    setQuestions(q);
    setCurrentIdx(0);
    setSelections(new Array<number | null>(q.length).fill(null));
    setFinished(false);
    setInSetup(false);
  };

  // Selection of the question currently on screen (derived, not own state,
  // so navigating back shows the stored answer).
  const selected = selections[currentIdx] ?? null;

  // Timer
  useEffect(() => {
    if (!timerEnabled || finished || selected !== null) return;
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up — treat as wrong
          if (timerRef.current) clearInterval(timerRef.current);
          setSelections((s) =>
            s.map((v, i) => (i === currentIdx ? -1 : v)) // -1 = timeout
          );
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
    setSelections((s) => s.map((v, i) => (i === currentIdx ? optionIdx : v)));
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    setCurrentIdx((i) => Math.max(0, i - 1));
  };

  const handleRestart = () => {
    startQuiz();
  };

  // Grading derived from the per-question selections.
  const answers = questions.map(
    (q, i) => selections[i] !== null && selections[i] === q.correctIndex
  );
  const answeredCount = selections.filter((s) => s !== null).length;
  const correctCount = answers.filter(Boolean).length;
  const scorePercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Multiple Choice",
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

  // Load failed (offline / server error) — distinct from "too few cards".
  if (loadError) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Multiple Choice",
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
            gap: spacing.lg,
          }}
        >
          <Text
            style={{
              fontSize: typography.lg,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            {t("common.loadError")}
          </Text>
          <TouchableOpacity
            onPress={loadCards}
            activeOpacity={0.8}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>
              {t("common.retry")}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  if (cards.length < 2) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Multiple Choice",
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
            Mindestens 2 Karten nötig für Multiple Choice.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // Setup — direction + question kinds, before the quiz starts
  if (inSetup) {
    const typeRow = (
      label: string,
      value: boolean,
      onChange: (v: boolean) => void,
      border = true
    ) => (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.sm,
          borderBottomWidth: border ? 1 : 0,
          borderBottomColor: colors.borderLight,
        }}
      >
        <Text style={{ fontSize: typography.base, color: colors.text }}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
          thumbColor="#ffffff"
          ios_backgroundColor={colors.surfaceSecondary}
        />
      </View>
    );

    const setupCardStyle = {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    } as const;

    return (
      <>
        <Stack.Screen
          options={{
            title: deckTitle ?? "Multiple Choice",
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
            contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, gap: spacing.lg }}
            showsVerticalScrollIndicator={false}
          >
            {/* Intro */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: colors.accentLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Brain size={32} color={colors.accent} />
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
                {deckTitle ?? "Multiple Choice"}
              </Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
                Antwort aus Optionen wählen
              </Text>
            </View>

            {/* Richtung — one arrow in the middle, tap to swap */}
            <TouchableOpacity
              onPress={() => setReverse((r) => !r)}
              activeOpacity={0.8}
              style={setupCardStyle}
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
                  {reverse ? "Rückseite" : "Vorderseite"}
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
                  {reverse ? "Vorderseite" : "Rückseite"}
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

            {/* Fragetypen */}
            <View style={setupCardStyle}>
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  marginBottom: spacing.xs,
                }}
              >
                Fragetypen
              </Text>
              {typeRow("Multiple Choice", typeMC, setTypeMC)}
              {typeRow("Wahr / Falsch", typeTF, setTypeTF, false)}
              {!anyType && (
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.error,
                    marginTop: spacing.xs,
                  }}
                >
                  Mindestens ein Typ muss an sein.
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }} />

            {/* Start */}
            <TouchableOpacity
              onPress={startQuiz}
              disabled={!anyType}
              activeOpacity={0.85}
              style={{
                backgroundColor: anyType ? colors.primary : colors.surfaceSecondary,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Text
                style={{
                  color: anyType ? colors.textInverse : colors.textTertiary,
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
            <View style={{ width: "100%", gap: spacing.sm }}>
              <TouchableOpacity
                onPress={handleRestart}
                style={{
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
                onPress={() => setInSetup(true)}
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

  // Active quiz
  return (
    <>
      <Stack.Screen
        options={{
          title: deckTitle ?? "Multiple Choice",
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

          {/* Bottom row: back to the previous (answered) question + next.
              Past questions show their locked answer; Weiter moves forward. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={currentIdx === 0}
              activeOpacity={0.7}
              style={{
                width: 50,
                height: 50,
                borderRadius: radius.full ?? 999,
                backgroundColor: colors.surfaceSecondary,
                justifyContent: "center",
                alignItems: "center",
                opacity: currentIdx === 0 ? 0.3 : 1,
              }}
            >
              <ArrowLeft size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            {selected !== null && (
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.8}
                style={{
                  flex: 1,
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
        </View>
      </SafeAreaView>
    </>
  );
}
