import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, Stack } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Layers, RotateCcw } from "lucide-react-native";
import LearnScreen from "../(tabs)/learn";
import { listCardsInDeck, type Card } from "../../src/lib/api";
import { excludeOcclusionCards } from "../../src/lib/occlusion";
import { fetchDeckStats } from "../../src/lib/statsApi";
import {
  CardSourcePicker,
  filterBySource,
  isCardDue,
  type CardSource,
} from "../../src/components/cardSourcePicker";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import {
  isProgressUsable,
  loadSessionProgress,
  type SessionProgress,
  type StoredCardResult,
} from "../../src/features/review/sessionProgress";
import {
  loadSetup,
  resolveSource,
  saveSetup,
  type StoredSetup,
} from "../../src/lib/setupMemory";

// Full-screen "Karteikarten" session for a single deck. Opens with a setup
// screen (direction + Starten) like the other study modes, then reuses the
// review UI from the (parked) learn tab, scoped to one deck via its id.
export default function DeckReviewScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const colors = useColors();

  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  // Where an earlier session for this deck stopped, if any. Offered rather than
  // applied — a position from days ago may not be what the learner wants now.
  const [saved, setSaved] = useState<SessionProgress | null>(null);
  // Card to start on once "Weitermachen" was chosen; undefined starts at the top.
  const [resumeIndex, setResumeIndex] = useState<number | undefined>(undefined);
  // Ergebnisse der unterbrochenen Sitzung (#595) — nur beim Weitermachen
  // gesetzt, damit „Von vorne beginnen" ohne alte Ergebnisse startet.
  const [resumeResults, setResumeResults] = useState<
    Record<string, StoredCardResult> | undefined
  >(undefined);

  // Card-source data for the picker: the deck's cards (counts) + its wobbly ids.
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [wobblyIds, setWobblyIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadCards = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(id);
      setAllCards(excludeOcclusionCards(fetched));
      // Wobbly ids power the "Nur Wackelkandidaten" source. Optional — never
      // fail the setup (or show the retry) if the stats endpoint is down.
      try {
        const stats = await fetchDeckStats(id);
        setWobblyIds(new Set(stats.wobblyCards.map((card) => card.cardId)));
      } catch {
        setWobblyIds(new Set());
      }
    } catch {
      // Distinguish a load failure (offline / server error) from an empty deck,
      // so we can offer a retry instead of a picker with no counts.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Stored progress is read once per screen; the resume offer below only shows
  // when it still matches the pile the current settings produce.
  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadSessionProgress(id, "flashcards").then((progress) => {
      if (active) setSaved(progress);
    });
    return () => {
      active = false;
    };
  }, [id]);

  // #610: Zuletzt gestartete Einstellungen dieses Decks als Vorbelegung. Der
  // Merker wird asynchron gelesen und erst angewendet, wenn auch die Karten da
  // sind — die gemerkte Quelle wird nur übernommen, wenn sie heute wieder
  // Karten hätte (eine leere Quelle wäre eine Sackgasse mit gesperrtem Start).
  const [storedSetup, setStoredSetup] = useState<StoredSetup | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadSetup(id, "flashcards").then((stored) => {
      if (active) setStoredSetup(stored);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const starredCount = allCards.filter((card) => card.starred).length;
  const wobblyCount = allCards.filter((card) => wobblyIds.has(card.id)).length;
  const dueCount = allCards.filter((card) => isCardDue(card)).length;
  const studyPool = filterBySource(allCards, source, wobblyIds);

  const setupRestoredRef = useRef(false);
  useEffect(() => {
    if (setupRestoredRef.current || loading || storedSetup === undefined) return;
    if (phase !== "setup") return;
    setupRestoredRef.current = true;
    if (storedSetup?.reverse !== undefined) setReverse(storedSetup.reverse);
    const wanted = resolveSource(storedSetup?.source, {
      starred: starredCount,
      wobbly: wobblyCount,
      due: dueCount,
    });
    if (wanted) setSource(wanted);
    // Ohne gemerkte Wahl ist das Tagespensum die Voreinstellung (#610):
    // „Nur fällige", sobald es gerade welche gibt.
    else if (!storedSetup?.source && dueCount > 0) setSource("due");
  }, [loading, storedSetup, phase, starredCount, wobblyCount, dueCount]);

  // Offer the resume only while it is genuinely usable: same source, and the
  // stored card still sits at the stored position (cards may have been added,
  // deleted or unstarred since). Switching the source hides the offer, because
  // an index into one pile says nothing about another.
  const canResume =
    saved !== null && isProgressUsable(saved, studyPool.map((card) => card.id), source);

  const beginSession = (startAt?: number) => {
    setResumeIndex(startAt);
    // Beim Weitermachen wandern die gespeicherten Ergebnisse der Vor-Sitzung
    // mit in die Auswertung (#595); „Von vorne beginnen" startet ohne sie.
    setResumeResults(startAt !== undefined ? saved?.results : undefined);
    // Resuming restores the direction the interrupted session ran with, so the
    // continued cards are asked the same way round as the ones before them.
    if (startAt !== undefined && saved) setReverse(saved.reverse);
    // Beim Start die Wahl für dieses Deck merken (#610) — mit der Richtung,
    // in der die Runde wirklich läuft (beim Weitermachen die der alten Runde).
    if (id)
      void saveSetup(id, "flashcards", {
        reverse: startAt !== undefined && saved ? saved.reverse : reverse,
        source,
      });
    setPhase("play");
  };

  if (phase === "play") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LearnScreen
          deckId={id}
          deckTitle={title}
          initialShowBackFirst={reverse}
          source={source}
          wobblyIds={[...wobblyIds]}
          initialIndex={resumeIndex}
          initialResults={resumeResults}
        />
      </>
    );
  }

  // Header shared by the setup / loading / error states (the play state hides it).
  const setupHeader = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: title ?? "Karteikarten",
        headerBackTitle: "Zurück",
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    />
  );

  if (loading) {
    return (
      <>
        {setupHeader}
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

  // Load failed (offline / server error) — offer a retry, #208-style.
  if (loadError) {
    return (
      <>
        {setupHeader}
        <SafeAreaView
          edges={["bottom"]}
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
            Die Karten konnten nicht geladen werden.
          </Text>
          <TouchableOpacity
            onPress={loadCards}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <RotateCcw size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>
              Erneut versuchen
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

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
      {setupHeader}
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, gap: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.lg }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                backgroundColor: colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Layers size={32} color={colors.primary} />
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
              {title ?? "Karteikarten"}
            </Text>
            <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
              Klassisch umdrehen & bewerten
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
              Richtung tauschen
            </Text>
          </TouchableOpacity>

          {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
          <CardSourcePicker
            value={source}
            onChange={setSource}
            allCount={allCards.length}
            starredCount={starredCount}
            wobblyCount={wobblyCount}
            dueCount={dueCount}
          />

          <View style={{ flex: 1 }} />

          {/* Weitermachen — only when an interrupted session still fits */}
          {canResume && saved && (
            <TouchableOpacity
              onPress={() => beginSession(saved.index)}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                marginBottom: spacing.sm,
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
                Weitermachen
              </Text>
              <Text
                style={{
                  color: colors.textInverse,
                  fontSize: typography.sm,
                  marginTop: 2,
                }}
              >
                {`Karte ${saved.index + 1} von ${studyPool.length}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Start — becomes the secondary action once a resume is offered */}
          <TouchableOpacity
            onPress={() => beginSession(undefined)}
            disabled={studyPool.length === 0}
            activeOpacity={0.85}
            style={{
              backgroundColor:
                studyPool.length === 0
                  ? colors.surfaceSecondary
                  : canResume
                    ? colors.surface
                    : colors.primary,
              borderWidth: canResume && studyPool.length > 0 ? 1 : 0,
              borderColor: colors.border,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              ...(canResume ? {} : shadows.md),
            }}
          >
            <Text
              style={{
                color:
                  studyPool.length === 0
                    ? colors.textTertiary
                    : canResume
                      ? colors.text
                      : colors.textInverse,
                fontWeight: typography.bold,
                fontSize: typography.lg,
              }}
            >
              {canResume ? "Von vorne beginnen" : "Starten"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
