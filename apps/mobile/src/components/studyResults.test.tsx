import React from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, create, type ReactTestRenderer, type ReactTestInstance } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resources } from "../i18n/resources";

const mocks = vi.hoisted(() => ({
  language: "de" as "de" | "en", push: vi.fn(), back: vi.fn(), reviewStart: vi.fn(),
  listCards: vi.fn(), sendReview: vi.fn(), earnLp: vi.fn(), recordAttempt: vi.fn(),
  getItem: vi.fn(), setItem: vi.fn(), saveSetup: vi.fn(), dueCards: vi.fn(),
}));
vi.mock("react-native", () => ({
  ...Object.fromEntries(["ActivityIndicator", "Image", "KeyboardAvoidingView", "ScrollView", "Switch", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name])),
  AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Platform: { OS: "ios" }, Alert: { alert: vi.fn() },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ deckId: "local-deck", deckTitle: "Lokale Karten" }),
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
  Stack: { Screen: () => null }, useFocusEffect: () => {},
}));
vi.mock("@react-navigation/native", () => ({ usePreventRemove: () => {} }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: mocks.getItem, setItem: mocks.setItem } }));
vi.mock("lucide-react-native", () => Object.fromEntries([
  "Trophy", "RotateCcw", "Timer", "Star", "Pencil", "HelpCircle", "Puzzle", "Zap", "CheckCircle2", "XCircle", "ArrowLeft", "ArrowRight", "Check", "FileText", "Brain", "Plus", "Minus", "ArrowLeftRight", "Volume2", "Play", "Pause",
].map(name => [name, (props: Record<string, unknown>) => React.createElement(name, props)])));
function translate(key: string, values: Record<string, unknown> = {}) {
  const value = resources[mocks.language].translation[key as keyof typeof resources.de.translation] ?? String(values.defaultValue ?? key);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? `{{${name}}}`));
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("../theme", () => ({
  useColors: () => ({ success: "green", successLight: "palegreen", primary: "blue", text: "black", textInverse: "white", warning: "orange" }),
  spacing: { sm: 8, md: 16, lg: 24, xl: 32, xxl: 40 }, radius: { md: 12, full: 999 }, typography: {}, shadows: {},
}));
vi.mock("../store/sessionStore", () => ({ useSessionStore: (select: (s: { userId: string }) => unknown) => select({ userId: "synthetic-user" }) }));
vi.mock("../store/usageStore", () => ({ useUsageStore: (select: (s: Record<string, unknown>) => unknown) => select({ setUsage: vi.fn(), lpEarnCapToday: 30 }) }));
vi.mock("../lib/api", () => ({
  listCardsInDeck: mocks.listCards, earnLp: mocks.earnLp, recordTestAttempt: mocks.recordAttempt,
  listDecks: async () => ({ decks: [] }), getDueCards: mocks.dueCards, reviewCard: vi.fn(),
  getStats: async () => ({ stats: { dailyGoal: 0, reviewsToday: 0 } }), updateCard: vi.fn(),
}));
vi.mock("../features/sync/sendReview", () => ({ sendReview: mocks.sendReview, shouldRetryLater: () => false }));
vi.mock("../features/review/reviewSession", async importOriginal => {
  const actual = await importOriginal<typeof import("../features/review/reviewSession")>();
  mocks.reviewStart.mockImplementation((...args: Parameters<ReturnType<typeof actual.useReviewSession.getState>["start"]>) => actual.useReviewSession.getState().start(...args));
  const hook = (select?: (s: ReturnType<typeof actual.useReviewSession.getState>) => unknown) => {
    const state = actual.useReviewSession();
    const exposed = { ...state, start: mocks.reviewStart };
    return select ? select(exposed) : exposed;
  };
  return { ...actual, useReviewSession: Object.assign(hook, { getState: actual.useReviewSession.getState }) };
});
vi.mock("react-native-gesture-handler", () => {
  const chain = () => {
    const builder = { onUpdate: () => builder, onEnd: () => builder, minDistance: () => builder, maxDuration: () => builder };
    return builder;
  };
  return { GestureHandlerRootView: "View", GestureDetector: "View", Gesture: { Pan: chain, Tap: chain, Simultaneous: () => ({}) } };
});
vi.mock("react-native-reanimated", () => ({
  default: { View: "View" }, useSharedValue: (value: number) => React.useRef({ value }).current,
  useAnimatedStyle: (build: () => unknown) => build(), withTiming: (n: number) => n, withSpring: (n: number) => n,
  interpolate: () => 0, runOnJS: (fn: unknown) => fn, Easing: { out: (fn: unknown) => fn, cubic: () => {} }, Extrapolation: { CLAMP: "clamp" },
}));
vi.mock("expo-speech", () => ({ stop: vi.fn(), speak: vi.fn() }));
vi.mock("../features/sync/offlineQueueStore", () => ({
  useOfflineQueueStore: Object.assign((select: (s: Record<string, unknown>) => unknown) => select({ enqueue: vi.fn(), acknowledgeRejected: vi.fn() }), {
    getState: () => ({ queue: { rejectedCount: 0 }, persistPending: vi.fn() }),
  }), createReviewSyncOperation: vi.fn(), syncPendingReviewOperations: async () => {},
}));
vi.mock("../features/review/sessionProgressSync", () => ({ clearProgressEverywhere: vi.fn(), pushProgressToAccount: vi.fn() }));
vi.mock("../lib/statsApi", () => ({ fetchDeckStats: async () => ({ wobblyCards: [] }) }));
vi.mock("../lib/lastUsedDeck", () => ({ setLastUsedDeck: vi.fn() }));
vi.mock("../lib/useDisplayName", () => ({ useDisplayName: () => "Lara" }));
vi.mock("../lib/setupMemory", async importOriginal => ({
  ...await importOriginal<typeof import("../lib/setupMemory")>(), loadSetup: async () => null, saveSetup: mocks.saveSetup,
}));
vi.mock("./CardEditor", () => ({ default: () => null }));
import MatchScreen from "../../app/match";
import TestScreen from "../../app/test";
import QuizScreen from "../../app/quiz";
import { StudyResult } from "./StudyResult";
import LearnScreen from "../../app/(tabs)/learn";
import { useReviewSession } from "../features/review/reviewSession";

const cards = [
  { id: "a", front: "Hund", back: "dog", type: "basic", starred: true },
  { id: "b", front: "Katze", back: "cat", type: "basic" },
  { id: "c", front: "Vogel", back: "bird", type: "basic" },
];
let renderer: ReactTestRenderer;
let artifactCount = 0;
function text(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === "string" ? child : text(child)).join("");
}
function buttons() { return renderer.root.findAllByType("TouchableOpacity" as never); }
function button(label: string) { return buttons().find(node => text(node) === label); }
async function press(label: string) {
  const node = button(label);
  expect(node, `reachable button: ${label}`).toBeDefined();
  expect(node!.props.disabled).not.toBe(true);
  await act(async () => { await node!.props.onPress(); });
}
async function show(Component: React.ComponentType) {
  await act(async () => { renderer = create(<Component />); });
}
function expectFrame() {
  expect(renderer.root.findAllByType(StudyResult)).toHaveLength(1);
  const trophy = renderer.root.findAllByType("Trophy" as never).find(n => n.props.size === 34)!;
  expect(trophy.props.color).toBe("green");
  expect(trophy.parent!.parent!.props.style).toMatchObject({ width: 72, height: 72, backgroundColor: "palegreen" });
  // Opt-in local QA evidence, never written during normal CI.
  const artifactDir = process.env.STUDY_RESULT_QA_DIR;
  if (artifactDir) {
    mkdirSync(artifactDir, { recursive: true });
    const name = `${++artifactCount}-${mocks.language}-${expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]+/g, "-")}.json`;
    writeFileSync(join(artifactDir, name), JSON.stringify(renderer.toJSON(), null, 2));
  }
}
async function finishMatch(miss = true) {
  if (miss) {
    await press("Hund"); await press("Katze");
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  }
  for (const c of cards) { await press(c.front); await press(c.back); }
}
async function finishWritten(answers: string[]) {
  for (let i = 0; i < answers.length; i++) {
    const input = renderer.root.findByType("TextInput" as never);
    await act(async () => input.props.onChangeText(answers[i]));
    await press(i === answers.length - 1 ? "Abgeben" : "Weiter");
  }
}
beforeEach(() => {
  vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request in local UI QA"); }));
  vi.clearAllMocks(); mocks.language = "de";
  mocks.reviewStart.mockImplementation((...args: Parameters<ReturnType<typeof useReviewSession.getState>["start"]>) => useReviewSession.getState().start(...args));
  vi.spyOn(Math, "random").mockReturnValue(0.99); // Keeps source order; question types are selected through setup controls.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  mocks.dueCards.mockResolvedValue({ cards });
  mocks.listCards.mockResolvedValue({ cards }); mocks.sendReview.mockResolvedValue({});
  mocks.earnLp.mockResolvedValue({ granted: 3, capReached: false, newBalance: 12 });
  mocks.recordAttempt.mockResolvedValue({}); mocks.getItem.mockResolvedValue(null); mocks.setItem.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined as unknown as ReactTestRenderer;
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
for (const language of ["de", "en"] as const) {
  describe(`mounted results ${language}`, () => {
    beforeEach(() => { mocks.language = language; });
    it("repeats only missed matching pairs, resets errors and reports the next round once", async () => {
      await show(MatchScreen); await press("Starten"); await finishMatch();
      expect(mocks.sendReview.mock.calls.map(([r]) => [r.cardId, r.rating, r.mode])).toEqual([["a", "again", "match"], ["b", "again", "match"], ["c", "good", "match"]]);
      const retry = translate("review.onlyWrong", { count: 2 });
      expect(button(retry)?.props.accessibilityRole).toBe("button");
      await press(retry);
      expect(text(renderer.root)).toContain("0 / 2 Paare");
      expect(text(renderer.root)).toContain("0 Fehler");
      expect(button("Vogel")).toBeUndefined();
      for (const c of cards.slice(0, 2)) { await press(c.front); await press(c.back); }
      expect(button(translate("review.onlyWrong", { count: 2 }))).toBeUndefined();
      expect(mocks.sendReview).toHaveBeenCalledTimes(5);
      expect(mocks.sendReview.mock.calls.slice(3).map(([r]) => [r.cardId, r.rating])).toEqual([["a", "good"], ["b", "good"]]);
      expect(mocks.earnLp.mock.calls).toEqual([["session", 3], ["session", 2]]);
      await press(translate("review.againAll"));
      expect(text(renderer.root)).toContain("0 / 3 Paare");
    });
    it("has a shared green matching result without misses and reachable setup", async () => {
      await show(MatchScreen); await press("Starten"); await finishMatch(false);
      expectFrame();
      expect(button(translate("review.onlyWrong", { count: 0 }))).toBeUndefined();
      await press(language === "de" ? "Einstellungen" : "Settings");
      expect(button("Starten")).toBeDefined();
    });
    it("repeats exam misses in the exam, excluding overridden answers, and keeps full retry separate", async () => {
      await show(TestScreen);
      const switches = renderer.root.findAllByType("Switch" as never);
      await act(async () => { switches[0]!.props.onValueChange(false); switches[1]!.props.onValueChange(false); });
      await press("Test starten"); await finishWritten(["bad", "bad", "bird"]);
      expect(mocks.recordAttempt.mock.calls[0]![3]).toEqual([{ cardId: "a", correct: false }, { cardId: "b", correct: false }, { cardId: "c", correct: true }]);
      await press(translate("study.overrideCorrect")); // First question is overridden; only b remains.
      expectFrame();
      expect(text(renderer.root)).toContain("67%");
      const retry = translate("review.onlyWrong", { count: 1 });
      await press(retry);
      expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.reviewStart).not.toHaveBeenCalled();
      expect(text(renderer.root)).toContain("Frage 1 von 1");
      expect(text(renderer.root)).toContain("Katze");
      expect(renderer.root.findByType("TextInput" as never).props.value).toBe("");
      await finishWritten(["cat"]);
      expect(mocks.recordAttempt.mock.calls.at(-1)![3]).toEqual([{ cardId: "b", correct: true }]);
      expect(mocks.sendReview).toHaveBeenCalledTimes(4);
      expect(mocks.earnLp).not.toHaveBeenCalled();
      await press(translate("review.againAll"));
      expect(text(renderer.root)).toContain("Frage 1 von 3");
    });
    it("makes a one-card exam retry playable when only multiple choice was selected", async () => {
      await show(TestScreen);
      const switches = renderer.root.findAllByType("Switch" as never);
      await act(async () => { switches[0]!.props.onValueChange(false); switches[2]!.props.onValueChange(false); });
      await press("Test starten");
      for (let i = 0; i < cards.length; i++) {
        await press(i === 1 ? "dog" : cards[i]!.back);
        await press(i === cards.length - 1 ? "Abgeben" : "Weiter");
      }
      await press(translate("review.onlyWrong", { count: 1 }));
      expect(text(renderer.root)).toContain("Katze");
      expect(renderer.root.findAllByType("TextInput" as never)).toHaveLength(1);
      expect(text(renderer.root)).toContain(language === "de" ? "Schriftlich" : "Written");
      await finishWritten(["cat"]);
      expect(text(renderer.root)).toContain("100%");
    });
    it("keeps matching timing and result metrics when retrying the missed pairs", async () => {
      await show(MatchScreen);
      await act(async () => renderer.root.findByType("Switch" as never).props.onValueChange(true));
      await press("Starten");
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      await finishMatch();
      expectFrame();
      expect(text(renderer.root)).toContain("0:03");
      expect(text(renderer.root)).toContain(translate("study.matchedPairs", { count: 3 }));
      expect(text(renderer.root)).toContain(translate("study.errors", { count: 1 }));
      expect(text(renderer.root)).toContain(translate("lp.earnedThisRound", { count: 3 }));
      await press(translate("review.onlyWrong", { count: 2 }));
      expect(text(renderer.root)).toContain("0:00");
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(text(renderer.root)).toContain("0:01");
    });
    it("keeps the separate flashcard route and original card order/content without new reviews", async () => {
      await show(TestScreen);
      const switches = renderer.root.findAllByType("Switch" as never);
      await act(async () => { switches[0]!.props.onValueChange(false); switches[1]!.props.onValueChange(false); });
      await press("Test starten"); await finishWritten(["bad", "bad", "bird"]);
      const reported = mocks.sendReview.mock.calls.length;
      await press(translate("review.practiceMissed", { count: 2 }));
      expect(mocks.reviewStart).toHaveBeenLastCalledWith(cards.slice(0, 2).map(({ id, front, back }) => ({ id, front, back })));
      expect(mocks.push).toHaveBeenCalledWith("/practice?title=Lokale%20Karten");
      expect(mocks.sendReview).toHaveBeenCalledTimes(reported);
      expect(mocks.earnLp).not.toHaveBeenCalled();
    });
    it("resets the exam timer to the actual subset size and retains the selected setup", async () => {
      await show(TestScreen);
      const switches = renderer.root.findAllByType("Switch" as never);
      await act(async () => { switches[0]!.props.onValueChange(false); switches[1]!.props.onValueChange(false); switches[4]!.props.onValueChange(true); });
      await press("Test starten");
      expect(text(renderer.root)).toContain("1:30");
      await finishWritten(["bad", "bad", "bird"]);
      await press(translate("review.onlyWrong", { count: 2 }));
      expect(text(renderer.root)).toContain("Frage 1 von 2");
      expect(text(renderer.root)).toContain("1:00");
      await finishWritten(["dog", "cat"]);
      expect(text(renderer.root)).toContain("100%");
      await press(translate("study.settings"));
      const restored = renderer.root.findAllByType("Switch" as never);
      expect(restored.map(n => n.props.value)).toEqual([false, false, true, true, true]);
    });
    it("mounts the common flashcard result and repeats misses with original content/order", async () => {
      useReviewSession.getState().start(cards);
      useReviewSession.getState().rateCurrent("again");
      useReviewSession.getState().rateCurrent("good");
      useReviewSession.getState().rateCurrent("good");
      await show(LearnScreen);
      expectFrame();
      expect(text(renderer.root)).toContain(translate("review.resultBody", { total: 3, known: 2 }));
      await press(translate("review.onlyWrong", { count: 1 }));
      expect(useReviewSession.getState().cards).toEqual([cards[0]]);
      expect(useReviewSession.getState().index).toBe(0);
      expect(useReviewSession.getState().completed).toBe(false);
      expect(mocks.sendReview).not.toHaveBeenCalled();
    });
    it("keeps the global flashcard reload path and resets the round without reporting old answers again", async () => {
      useReviewSession.getState().start(cards);
      for (let i = 0; i < cards.length; i++) useReviewSession.getState().rateCurrent("good");
      await show(LearnScreen);
      expectFrame();
      await press(translate("review.againAll"));
      expect(mocks.dueCards).toHaveBeenCalledTimes(1);
      expect(useReviewSession.getState().cards.map(c => c.id)).toEqual(["a", "b", "c"]);
      expect(useReviewSession.getState().history).toEqual([]);
      expect(useReviewSession.getState().index).toBe(0);
      expect(useReviewSession.getState().completed).toBe(false);
      expect(mocks.sendReview).not.toHaveBeenCalled();
    });
    it("keeps the exam trophy green at zero and full marks and hides the empty subset action", async () => {
      await show(TestScreen);
      const switches = renderer.root.findAllByType("Switch" as never);
      await act(async () => { switches[0]!.props.onValueChange(false); switches[1]!.props.onValueChange(false); });
      await press("Test starten"); await finishWritten(["bad", "bad", "bad"]);
      expectFrame();
      expect(text(renderer.root)).toContain("0%");
      expect(button(translate("review.onlyWrong", { count: 3 }))).toBeDefined();
      await press(translate("review.againAll"));
      await finishWritten(["dog", "cat", "bird"]);
      expectFrame();
      expect(text(renderer.root)).toContain("100%");
      expect(button(translate("review.onlyWrong", { count: 0 }))).toBeUndefined();
      expect(button(translate("review.againAll"))!.props.style.backgroundColor).toBe("blue");
      expect(mocks.earnLp).not.toHaveBeenCalled();
    });
    it("repeats only quiz misses with the same mode and rearmed per-round LP accounting", async () => {
      await show(QuizScreen);
      await act(async () => renderer.root.findAllByType("Switch" as never)[0]!.props.onValueChange(false));
      await press("Starten");
      for (let i = 0; i < cards.length; i++) {
        await press(i === 2 ? `B${translate("quiz.falseLabel")}` : `A${translate("quiz.trueLabel")}`);
        await press(i === cards.length - 1 ? "Ergebnis" : "Weiter");
      }
      expectFrame();
      expect(text(renderer.root)).toContain("33%");
      expect(mocks.sendReview.mock.calls.map(([r]) => [r.cardId, r.rating, r.mode])).toEqual([["a", "again", "quiz"], ["b", "again", "quiz"], ["c", "good", "quiz"]]);
      await press(translate("review.onlyWrong", { count: 2 }));
      for (let i = 0; i < 2; i++) {
        await press(`B${translate("quiz.falseLabel")}`);
        await press(i === 1 ? "Ergebnis" : "Weiter");
      }
      expect(mocks.sendReview.mock.calls.slice(3).map(([r]) => [r.cardId, r.rating, r.mode])).toEqual([["a", "good", "quiz"], ["b", "good", "quiz"]]);
      expect(mocks.earnLp.mock.calls).toEqual([["session", 3], ["session", 2]]);
      expect(text(renderer.root)).toContain("100%");
      expect(button(translate("review.onlyWrong", { count: 0 }))).toBeUndefined();
    });
    it("uses the shared green quiz frame with score and all-repeat still working", async () => {
      await show(QuizScreen);
      await act(async () => renderer.root.findAllByType("Switch" as never)[0]!.props.onValueChange(false));
      await press("Starten");
      for (let i = 0; i < cards.length; i++) {
        // The generated true/false pairing is false with this deterministic random source.
        await press(`A${translate("quiz.trueLabel")}`);
        await press(i === cards.length - 1 ? "Ergebnis" : "Weiter");
      }
      expectFrame();
      expect(text(renderer.root)).toContain("0%");
      await press(translate("review.againAll"));
      expect(text(renderer.root)).toContain("Hund");
    });
  });
}
