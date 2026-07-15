import { useCallback, useEffect, useState } from "react";
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
import { fetchDeckStats } from "../../src/lib/statsApi";
import {
  CardSourcePicker,
  filterBySource,
  type CardSource,
} from "../../src/components/cardSourcePicker";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

// Full-screen "Karteikarten" session for a single deck. Opens with a setup
// screen (direction + Starten) like the other study modes, then reuses the
// review UI from the (parked) learn tab, scoped to one deck via its id.
export default function DeckReviewScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const colors = useColors();

  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");

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
      setAllCards(fetched);
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

  const starredCount = allCards.filter((card) => card.starred).length;
  const wobblyCount = allCards.filter((card) => wobblyIds.has(card.id)).length;
  const studyPool = filterBySource(allCards, source, wobblyIds);

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
              Tippen zum Tauschen
            </Text>
          </TouchableOpacity>

          {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
          <CardSourcePicker
            value={source}
            onChange={setSource}
            allCount={allCards.length}
            starredCount={starredCount}
            wobblyCount={wobblyCount}
          />

          <View style={{ flex: 1 }} />

          {/* Start */}
          <TouchableOpacity
            onPress={() => setPhase("play")}
            disabled={studyPool.length === 0}
            activeOpacity={0.85}
            style={{
              backgroundColor:
                studyPool.length === 0 ? colors.surfaceSecondary : colors.primary,
              paddingVertical: 16,
              borderRadius: radius.lg,
              alignItems: "center",
              ...shadows.md,
            }}
          >
            <Text
              style={{
                color:
                  studyPool.length === 0 ? colors.textTertiary : colors.textInverse,
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
