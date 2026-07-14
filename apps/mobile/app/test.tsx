import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Trophy,
  HelpCircle,
  Check,
  Timer,
  FileText,
} from "lucide-react-native";
import { listCardsInDeck, type Card } from "../src/lib/api";
import { isAnswerCorrect } from "../src/lib/answerCheck";
import {
  buildTestQuestions,
  type TestQuestion,
  type TestQuestionType,
} from "../src/lib/testQuestions";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

const SECONDS_PER_QUESTION = 30;

function lastResultKey(deckId: string) {
  return `test-last-result:${deckId}`;
}

function formatTime(s: number) {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface Answer {
  mc: number | null;
  tf: boolean | null;
  text: string;
}

interface Graded {
  correct: boolean;
  overridden: boolean;
}

type Phase = "setup" | "play" | "result";

export default function TestScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  // Settings
  const [count, setCount] = useState(0);
  const [typeTF, setTypeTF] = useState(true);
  const [typeMC, setTypeMC] = useState(true);
  const [typeWritten, setTypeWritten] = useState(true);
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [timed, setTimed] = useState(false);

  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unfiltered usable count — the "empty deck" screen must not depend on the
  // starred filter, or toggling it could lock the learner out of the setup.
  const deckUsableCount = useMemo(
    () =>
      allCards.filter(
        (c) => (c.front ?? "").trim().length > 0 && (c.back ?? "").trim().length > 0
      ).length,
    [allCards]
  );
  const starredCount = useMemo(
    () => allCards.filter((c) => c.starred).length,
    [allCards]
  );
  // Optional starred-only pool; the question count follows it.
  const pool = useMemo(
    () => (starredOnly ? allCards.filter((c) => c.starred) : allCards),
    [allCards, starredOnly]
  );
  const usableCount = useMemo(
    () =>
      pool.filter(
        (c) => (c.front ?? "").trim().length > 0 && (c.back ?? "").trim().length > 0
      ).length,
    [pool]
  );

  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setAllCards(fetched);
    } catch {
      // Distinguish a load failure (offline / server error) from a deck with no
      // usable cards, so we can offer a retry instead of the empty state.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    if (!deckId) return;
    loadCards();
    AsyncStorage.getItem(lastResultKey(deckId)).then((value) => {
      const n = value ? parseInt(value, 10) : NaN;
      if (!Number.isNaN(n)) setLastResult(n);
    });
  }, [deckId, loadCards]);

  // Default the question count to the maximum once cards are loaded.
  useEffect(() => {
    if (usableCount > 0) setCount(usableCount);
  }, [usableCount]);

  const countPresets = useMemo(() => {
    const values = [usableCount, 10, 20, 30].filter(
      (n, i, arr) => n > 0 && n <= usableCount && arr.indexOf(n) === i
    );
    return values;
  }, [usableCount]);

  const cycleCount = () => {
    if (countPresets.length <= 1) return;
    const i = countPresets.indexOf(count);
    setCount(countPresets[(i + 1) % countPresets.length]!);
  };

  const anyType = typeTF || typeMC || typeWritten;

  const startTest = () => {
    const types: TestQuestionType[] = [];
    if (typeTF) types.push("trueFalse");
    if (typeMC) types.push("mc");
    if (typeWritten) types.push("written");
    if (types.length === 0) return;

    const qs = buildTestQuestions(pool, {
      count: count || usableCount,
      types,
      reverse,
    });
    if (qs.length === 0) return;

    setQuestions(qs);
    setAnswers(qs.map(() => ({ mc: null, tf: null, text: "" })));
    setGraded([]);
    setIdx(0);
    setRemaining(timed ? qs.length * SECONDS_PER_QUESTION : 0);
    setPhase("play");
  };

  const setAnswer = (i: number, patch: Partial<Answer>) => {
    setAnswers((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  };

  const submit = () => {
    const result: Graded[] = questions.map((q, i) => {
      const a = answers[i] ?? { mc: null, tf: null, text: "" };
      let correct = false;
      if (q.type === "mc") correct = a.mc === q.correctIndex;
      else if (q.type === "trueFalse") correct = a.tf === q.tfIsCorrect;
      else correct = isAnswerCorrect(a.text, q.expected, { strict });
      return { correct, overridden: false };
    });
    setGraded(result);
    setPhase("result");
  };

  // Countdown (only in timed mode). Auto-submits when it hits zero.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (phase !== "play" || !timed) return;
    if (remaining <= 0) {
      submit();
      return;
    }
    timerRef.current = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timed, remaining]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scoredCount = graded.filter((g) => g.correct || g.overridden).length;
  const percent =
    questions.length > 0 ? Math.round((scoredCount / questions.length) * 100) : 0;

  // Persist the latest percentage (updates when an answer is overridden).
  useEffect(() => {
    if (phase === "result" && deckId) {
      AsyncStorage.setItem(lastResultKey(deckId), String(percent)).catch(() => {});
      setLastResult(percent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, percent]);

  const overrideCorrect = (i: number) => {
    setGraded((prev) => prev.map((g, j) => (j === i ? { ...g, overridden: true } : g)));
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

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  if (loading) {
    return (
      <>
        {screenHeader("Test")}
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      </>
    );
  }

  // Load failed (offline / server error) — distinct from "no usable cards".
  if (loadError) {
    return (
      <>
        {screenHeader("Test")}
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.xxl, gap: spacing.lg }}>
          <Text style={{ fontSize: typography.lg, color: colors.textSecondary, textAlign: "center", lineHeight: 24 }}>
            {t("common.loadError")}
          </Text>
          <TouchableOpacity
            onPress={loadCards}
            activeOpacity={0.8}
            style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }}
          >
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  if (deckUsableCount === 0) {
    return (
      <>
        {screenHeader("Test")}
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.xxl }}>
          <HelpCircle size={48} color={colors.textTertiary} />
          <Text style={{ marginTop: spacing.lg, fontSize: typography.lg, color: colors.textSecondary, textAlign: "center" }}>
            Dieses Deck hat keine Karten mit Frage und Antwort für einen Test.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // ─── Setup ───────────────────────────────────────────────────────────────
  if (phase === "setup") {
    const typeRow = (label: string, value: boolean, onChange: (v: boolean) => void, border = true) => (
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

    return (
      <>
        {screenHeader(deckTitle ?? "Test")}
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Intro */}
            <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: colors.errorLight, justifyContent: "center", alignItems: "center" }}>
                <FileText size={30} color={colors.error} />
              </View>
              <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>Test einrichten</Text>
              {lastResult != null && (
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Letztes Ergebnis: {lastResult} %</Text>
              )}
            </View>

            {/* Anzahl Fragen */}
            <TouchableOpacity onPress={cycleCount} activeOpacity={0.8} style={{ ...cardStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>Anzahl Fragen</Text>
              <Text style={{ fontSize: typography.base, fontWeight: typography.bold, color: colors.primary }}>
                {count >= usableCount ? `Alle (${usableCount})` : count}
              </Text>
            </TouchableOpacity>

            {/* Aufgabentypen */}
            <View style={cardStyle}>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>Aufgabentypen</Text>
              {typeRow("Wahr / Falsch", typeTF, setTypeTF)}
              {typeRow("Multiple Choice", typeMC, setTypeMC)}
              {typeRow("Schriftlich (tippen)", typeWritten, setTypeWritten, false)}
              {!anyType && (
                <Text style={{ fontSize: typography.xs, color: colors.error, marginTop: spacing.xs }}>Mindestens ein Typ muss an sein.</Text>
              )}
            </View>

            {/* Nur markierte Karten */}
            <View style={{ ...cardStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>Nur markierte Karten</Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                  {starredCount === 0 ? "Keine Karten markiert" : `${starredCount} markiert`}
                </Text>
              </View>
              <Switch
                value={starredOnly}
                onValueChange={setStarredOnly}
                disabled={starredCount === 0}
                trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                thumbColor="#ffffff"
                ios_backgroundColor={colors.surfaceSecondary}
              />
            </View>

            {/* Richtung — one arrow in the middle, tap to swap */}
            <TouchableOpacity onPress={() => setReverse((r) => !r)} activeOpacity={0.8} style={cardStyle}>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Abgefragte Richtung</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, textAlign: "right", fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>{reverse ? "Rückseite" : "Vorderseite"}</Text>
                <View style={{ width: 44, alignItems: "center" }}>
                  <ArrowRight size={22} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, textAlign: "left", fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>{reverse ? "Vorderseite" : "Rückseite"}</Text>
              </View>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary, textAlign: "center", marginTop: spacing.sm }}>Tippen zum Tauschen</Text>
            </TouchableOpacity>

            {/* Genau prüfen */}
            <View style={{ ...cardStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>Genau prüfen</Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>nur beim Eintippen</Text>
              </View>
              <Switch value={strict} onValueChange={setStrict} trackColor={{ false: colors.surfaceSecondary, true: colors.primary }} thumbColor="#ffffff" ios_backgroundColor={colors.surfaceSecondary} />
            </View>

            {/* Auf Zeit */}
            <View style={{ ...cardStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: colors.text }}>Auf Zeit</Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                  {timed ? `${formatTime((count || usableCount) * SECONDS_PER_QUESTION)} für die ganze Prüfung` : "optional, ohne Zeitdruck"}
                </Text>
              </View>
              <Switch value={timed} onValueChange={setTimed} trackColor={{ false: colors.surfaceSecondary, true: colors.primary }} thumbColor="#ffffff" ios_backgroundColor={colors.surfaceSecondary} />
            </View>

            <TouchableOpacity
              onPress={startTest}
              disabled={!anyType || usableCount === 0}
              activeOpacity={0.85}
              style={{ backgroundColor: anyType && usableCount > 0 ? colors.primary : colors.surfaceSecondary, paddingVertical: 16, borderRadius: radius.lg, alignItems: "center", ...shadows.md }}
            >
              <Text style={{ color: anyType && usableCount > 0 ? colors.textInverse : colors.textTertiary, fontWeight: typography.bold, fontSize: typography.lg }}>Test starten</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ─── Result ──────────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <>
        {screenHeader("Ergebnis")}
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: percent >= 50 ? colors.successLight : colors.errorLight, justifyContent: "center", alignItems: "center" }}>
                <Trophy size={38} color={percent >= 50 ? colors.success : colors.error} />
              </View>
              <Text style={{ fontSize: typography.xxxl, fontWeight: typography.extrabold, color: colors.text }}>{percent} %</Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>{scoredCount} von {questions.length} richtig</Text>
            </View>

            {/* Durchsicht */}
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.sm }}>Durchsicht</Text>
            {questions.map((q, i) => {
              const a = answers[i] ?? { mc: null, tf: null, text: "" };
              const g = graded[i] ?? { correct: false, overridden: false };
              const ok = g.correct || g.overridden;
              const yourAnswer =
                q.type === "mc"
                  ? a.mc != null ? q.options[a.mc] ?? "—" : "—"
                  : q.type === "trueFalse"
                    ? a.tf === true ? "Richtig" : a.tf === false ? "Falsch" : "—"
                    : a.text.trim() || "—";
              const solution =
                q.type === "trueFalse"
                  ? q.tfIsCorrect ? "Richtig" : "Falsch"
                  : q.expected;
              return (
                <View key={i} style={{ ...cardStyle, gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    {ok ? <CheckCircle2 size={18} color={colors.success} /> : <XCircle size={18} color={colors.error} />}
                    <Text style={{ flex: 1, fontSize: typography.sm, fontWeight: typography.semibold, color: colors.text }}>{q.prompt}</Text>
                  </View>
                  {q.type === "trueFalse" && (
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>Aussage: {q.tfShownBack}</Text>
                  )}
                  <Text style={{ fontSize: typography.sm, color: ok ? colors.success : colors.error }}>Du: {yourAnswer}</Text>
                  {!ok && <Text style={{ fontSize: typography.sm, color: colors.text }}>Lösung: {solution}</Text>}
                  {q.type === "written" && !g.correct && !g.overridden && (
                    <TouchableOpacity onPress={() => overrideCorrect(i)} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xs, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.success }}>
                      <Check size={16} color={colors.success} />
                      <Text style={{ color: colors.success, fontWeight: typography.semibold, fontSize: typography.sm }}>Trotzdem als richtig zählen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity onPress={startTest} activeOpacity={0.85} style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
                <RotateCcw size={18} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontWeight: typography.bold }}>Nochmal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPhase("setup")} activeOpacity={0.85} style={{ paddingVertical: 12, borderRadius: radius.md, alignItems: "center" }}>
                <Text style={{ color: colors.textSecondary, fontWeight: typography.semibold, fontSize: typography.base }}>Einstellungen</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // ─── Play ────────────────────────────────────────────────────────────────
  const q = questions[idx]!;
  const a = answers[idx] ?? { mc: null, tf: null, text: "" };
  const isLast = idx + 1 >= questions.length;
  const progress = questions.length > 0 ? (idx + 1) / questions.length : 0;

  return (
    <>
      {screenHeader(deckTitle ?? "Test")}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Progress + timer */}
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium }}>{idx + 1} / {questions.length}</Text>
                {timed && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Timer size={14} color={remaining <= 30 ? colors.error : colors.textSecondary} />
                    <Text style={{ fontSize: typography.sm, fontWeight: typography.bold, color: remaining <= 30 ? colors.error : colors.textSecondary }}>{formatTime(remaining)}</Text>
                  </View>
                )}
              </View>
              <View style={{ height: 4, backgroundColor: colors.surfaceSecondary, borderRadius: 2, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.max(progress * 100, 2)}%`, backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
            </View>

            {/* Prompt */}
            <View style={{ ...cardStyle, padding: spacing.xl, gap: spacing.md }}>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {q.type === "written" ? "Antwort eintippen" : q.type === "mc" ? "Wähle die richtige Antwort" : "Stimmt diese Zuordnung?"}
              </Text>
              <Text style={{ fontSize: typography.xl, fontWeight: typography.semibold, color: colors.text, lineHeight: 30 }}>{q.prompt}</Text>
              {q.type === "trueFalse" && (
                <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md }}>
                  <Text style={{ fontSize: typography.lg, color: colors.text, textAlign: "center" }}>{q.tfShownBack}</Text>
                </View>
              )}
            </View>

            {/* Input by type */}
            {q.type === "written" && (
              <TextInput
                key={idx}
                value={a.text}
                onChangeText={(t) => setAnswer(idx, { text: t })}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                placeholder="Antwort eintippen…"
                placeholderTextColor={colors.textTertiary}
                style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: typography.lg, backgroundColor: colors.surface, color: colors.text }}
              />
            )}

            {q.type === "mc" && (
              <View style={{ gap: spacing.sm }}>
                {q.options.map((opt, oi) => {
                  const selected = a.mc === oi;
                  return (
                    <TouchableOpacity
                      key={oi}
                      onPress={() => setAnswer(idx, { mc: oi })}
                      activeOpacity={0.8}
                      style={{ backgroundColor: selected ? colors.primaryLight : colors.surface, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, borderRadius: radius.md, padding: 14 }}
                    >
                      <Text style={{ fontSize: typography.base, fontWeight: selected ? typography.semibold : typography.normal, color: selected ? colors.primary : colors.text }}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.type === "trueFalse" && (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {[true, false].map((val) => {
                  const selected = a.tf === val;
                  return (
                    <TouchableOpacity
                      key={String(val)}
                      onPress={() => setAnswer(idx, { tf: val })}
                      activeOpacity={0.8}
                      style={{ flex: 1, backgroundColor: selected ? colors.primaryLight : colors.surface, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, borderRadius: radius.md, paddingVertical: 16, alignItems: "center" }}
                    >
                      <Text style={{ fontSize: typography.base, fontWeight: typography.semibold, color: selected ? colors.primary : colors.text }}>{val ? "Richtig" : "Falsch"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Back to the previous question (answers stay editable until
                Abgeben — like flipping pages in a real exam) + next/submit */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setIdx((i) => Math.max(0, i - 1))}
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
              <TouchableOpacity
                onPress={() => (isLast ? submit() : setIdx((i) => i + 1))}
                activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 15, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, ...shadows.sm }}
              >
                <Text style={{ color: colors.textInverse, fontWeight: typography.bold, fontSize: typography.base }}>{isLast ? "Abgeben" : "Weiter"}</Text>
                {!isLast && <ArrowRight size={18} color={colors.textInverse} />}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}
