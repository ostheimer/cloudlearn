import { useCallback, useEffect, useState, useRef } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Trophy,
  RotateCcw,
  Timer,
  Star,
  HelpCircle,
  Puzzle,
  CheckCircle2,
  Zap,
} from "lucide-react-native";
import { earnLp, listCardsInDeck, type Card } from "../src/lib/api";
import { sendReview } from "../src/features/sync/sendReview";
import { setLastUsedDeck } from "../src/lib/lastUsedDeck";
import { useDisplayName } from "../src/lib/useDisplayName";
import { finishRateModeRound } from "../src/lib/rateModeRound";
import { useSessionStore } from "../src/store/sessionStore";
import { useUsageStore } from "../src/store/usageStore";
import { excludeOcclusionCards } from "../src/lib/occlusion";
import { matchTileTexts } from "../src/lib/cardDisplay";
import { fetchDeckStats } from "../src/lib/statsApi";
import {
  CardSourcePicker,
  filterBySource,
  type CardSource,
} from "../src/components/cardSourcePicker";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_PAIRS = 6;

// Tile types
interface Tile {
  id: string;
  text: string;
  cardId: string;
  side: "front" | "back";
}

// Shuffle array
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Best time is stored per deck on the device (seconds).
function bestTimeStorageKey(deckId: string) {
  return `match-best-time:${deckId}`;
}

type Phase = "setup" | "playing" | "finished";

export default function MatchScreen() {
  const colors = useColors();
  const userId = useSessionStore((s) => s.userId);
  const displayName = useDisplayName();
  const setUsage = useUsageStore((s) => s.setUsage);
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();
  const router = useRouter();

  // Studying IS using the deck (#415) — and Zuordnen writes no review_logs,
  // so this marker is the only trace the server would ever see.
  useEffect(() => {
    if (deckId) void setLastUsedDeck({ id: deckId, title: deckTitle ?? "" });
  }, [deckId, deckTitle]);

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Mode + progression
  const [phase, setPhase] = useState<Phase>("setup");
  const [timed, setTimed] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const [wobblyIds, setWobblyIds] = useState<Set<string>>(new Set());
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  // The chosen source; matching needs at least two cards from it.
  const starredCount = cards.filter((c) => c.starred).length;
  const wobblyCount = cards.filter((c) => wobblyIds.has(c.id)).length;
  const pool = filterBySource(cards, source, wobblyIds);
  // Spielbar sind nur Karten, deren beide Seiten nach der Aufbereitung (#592)
  // Text haben — wie im Web: reine Bild-Karten ohne Beschriftung ergeben
  // keine Text-Kachel.
  const playable = pool.filter((card) => matchTileTexts(card) !== null);

  // Game state
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [errors, setErrors] = useState(0);
  // Karten, die mindestens einmal falsch zugeordnet wurden („nicht gewusst").
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set());
  // Punkte der Runde — Zahl aus der SERVER-Antwort, nie selbst gerechnet.
  const [earnedLp, setEarnedLp] = useState(0);
  // Verhindert doppeltes Abrechnen: der Abschluss-Effekt kann mehrfach feuern.
  const awardedRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [gameCards, setGameCards] = useState<Card[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load cards
  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setCards(excludeOcclusionCards(fetched));
      // Wobbly ids power the "Nur Wackelkandidaten" source. Optional — never
      // fail the mode (or show the retry) if the stats endpoint is down.
      try {
        const stats = await fetchDeckStats(deckId);
        setWobblyIds(new Set(stats.wobblyCards.map((c) => c.cardId)));
      } catch {
        setWobblyIds(new Set());
      }
    } catch {
      // Distinguish a load failure (offline / server error) from a deck that
      // genuinely has too few cards, so we can offer a retry instead.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  // Load cards + this deck's best time
  useEffect(() => {
    if (!deckId) return;
    loadCards();
    AsyncStorage.getItem(bestTimeStorageKey(deckId)).then((value) => {
      const seconds = value ? parseInt(value, 10) : NaN;
      if (!Number.isNaN(seconds)) setBestTime(seconds);
    });
  }, [deckId, loadCards]);

  const startGame = (allCards: Card[], withTimer: boolean) => {
    // Tiles come from the shared display texts (#592): the front of a cloze
    // card shows its gap as a blank — the raw {{cN::…}} would print the
    // matching back right on the question tile — and a pure image side shows
    // its caption instead of raw ![…](…) code. A card without text on both
    // sides cannot be a text tile and is skipped.
    const usable = allCards.flatMap((card) => {
      const texts = matchTileTexts(card);
      return texts ? [{ card, texts }] : [];
    });
    const selected = shuffle(usable).slice(0, Math.min(MAX_PAIRS, usable.length));
    setGameCards(selected.map((entry) => entry.card));

    // Create tiles: one "front" tile + one "back" tile per card.
    const newTiles: Tile[] = [];
    for (const { card, texts } of selected) {
      newTiles.push({
        id: `${card.id}-front`,
        text: texts.front,
        cardId: card.id,
        side: "front",
      });
      newTiles.push({
        id: `${card.id}-back`,
        text: texts.back,
        cardId: card.id,
        side: "back",
      });
    }
    setTiles(shuffle(newTiles));
    setSelectedTile(null);
    setMatchedIds(new Set());
    setWrongPair(null);
    setErrors(0);
    setMissedIds(new Set());
    setElapsed(0);
    setIsNewBest(false);
    // Für die neue Runde wieder scharf schalten, sonst wird sie nie gemeldet.
    // Und die Punktzahl zurücksetzen: Dieselben Karten am selben Tag bringen
    // keine weiteren Punkte — die alte Zahl stehen zu lassen wäre gelogen.
    awardedRef.current = false;
    setEarnedLp(0);
    setPhase("playing");

    // The stopwatch only runs in timed (Challenge) mode.
    if (timerRef.current) clearInterval(timerRef.current);
    if (withTimer) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    }
  };

  // Stop the timer whenever we leave the playing phase
  useEffect(() => {
    if (phase !== "playing" && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [phase]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Detect completion → record best time (timed only) and show the result
  useEffect(() => {
    if (phase === "playing" && tiles.length > 0 && matchedIds.size === tiles.length) {
      if (timed) {
        if (bestTime == null || elapsed < bestTime) {
          setBestTime(elapsed);
          setIsNewBest(true);
          if (deckId) {
            AsyncStorage.setItem(bestTimeStorageKey(deckId), String(elapsed)).catch(
              () => {}
            );
          }
        }
      }
      setPhase("finished");

      // Runde melden (Issue #406): Zuordnen meldete in der App bisher gar
      // nichts — kein Streak, keine Statistik, keine Punkte.
      //
      // Bewertung wie im Web: eine Karte, die mindestens einmal danebenging,
      // gilt als „nicht gewusst". Ein Treffer beweist beim Zuordnen wenig, das
      // letzte Paar findet man auch durch Ausschluss — deshalb bewegt der
      // Modus "match" den Lernplan nur bei Fehlern.
      //
      // awardedRef: Der Effekt hängt an mehreren Werten und kann erneut
      // feuern; ohne die Sperre würde die Runde doppelt gemeldet.
      if (userId && !awardedRef.current) {
        awardedRef.current = true;
        const cardIds = Array.from(new Set(tiles.map((t) => t.cardId)));
        void (async () => {
          const result = await finishRateModeRound(
            cardIds.map((cardId) => ({ cardId, correct: !missedIds.has(cardId) })),
            {
              reportReview: (cardId, rating) =>
                sendReview({ userId, cardId, rating, mode: "match" }),
              earn: async (count) => {
                const res = await earnLp("session", count);
                if (res.granted > 0) setUsage({ lpBalance: res.newBalance });
                return { granted: res.granted, capReached: res.capReached };
              },
            }
          );
          setEarnedLp(result.granted);
        })();
      }
    }
  }, [matchedIds, tiles, phase, timed, elapsed, bestTime, deckId, userId, missedIds, setUsage]);

  const handleTilePress = (tile: Tile) => {
    if (matchedIds.has(tile.id) || wrongPair) return;

    if (!selectedTile) {
      // First selection
      setSelectedTile(tile);
    } else if (selectedTile.id === tile.id) {
      // Same tile — deselect
      setSelectedTile(null);
    } else {
      // Second selection — check match
      if (selectedTile.cardId === tile.cardId && selectedTile.side !== tile.side) {
        // Match!
        setMatchedIds((prev) => {
          const next = new Set(prev);
          next.add(selectedTile.id);
          next.add(tile.id);
          return next;
        });
        setSelectedTile(null);
      } else {
        // Wrong match
        setErrors((e) => e + 1);
        setWrongPair([selectedTile.id, tile.id]);
        // Beide beteiligten Karten als „nicht gewusst" merken — wie im Web.
        // `errors` allein ist nur eine Zahl; für die Wiederholung muss klar
        // sein, WELCHE Karte hakt.
        setMissedIds((prev) => {
          const next = new Set(prev);
          next.add(selectedTile.cardId);
          next.add(tile.cardId);
          return next;
        });
        // Brief flash, then reset
        setTimeout(() => {
          setWrongPair(null);
          setSelectedTile(null);
        }, 600);
      }
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const tileWidth = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2;
  const pairCount = Math.min(MAX_PAIRS, playable.length);

  const screenHeader = (title: string, backTitle: string) => (
    <Stack.Screen
      options={{
        title,
        headerBackTitle: backTitle,
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    />
  );

  if (loading) {
    return (
      <>
        {screenHeader("Zuordnen", "Zurück")}
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
        {screenHeader("Zuordnen", "Zurück")}
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
            Konnte nicht laden — bist du offline?
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
              Erneut versuchen
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  if (cards.filter((card) => matchTileTexts(card) !== null).length < 2) {
    return (
      <>
        {screenHeader("Zuordnen", "Zurück")}
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
              fontSize: typography.xl,
              fontWeight: typography.bold,
              color: colors.text,
              textAlign: "center",
            }}
          >
            Zu wenige Karten
          </Text>
          <Text
            style={{
              marginTop: spacing.sm,
              fontSize: typography.base,
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            Zum Zuordnen braucht das Deck mindestens 2 Karten.
          </Text>
        </SafeAreaView>
      </>
    );
  }

  // Setup — choose timed vs untimed before starting
  if (phase === "setup") {
    return (
      <>
        {screenHeader(deckTitle ?? "Zuordnen", "Zurück")}
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
                  backgroundColor: colors.accentLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Puzzle size={32} color={colors.accent} />
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
                {deckTitle ?? "Zuordnen"}
              </Text>
              <Text style={{ fontSize: typography.base, color: colors.textSecondary }}>
                {pairCount} Paare zuordnen
              </Text>
            </View>

            {/* Auf Zeit toggle */}
            <View style={{ gap: spacing.md }}>
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
                    Auf Zeit
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {timed
                      ? "Stoppuhr läuft mit — schlag deine Bestzeit"
                      : "Entspannt üben, ohne Zeitdruck"}
                  </Text>
                </View>
                <Switch
                  value={timed}
                  onValueChange={setTimed}
                  trackColor={{ false: colors.surfaceSecondary, true: colors.primary }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.surfaceSecondary}
                />
              </View>

              {/* Best time (only meaningful for the timed challenge) */}
              {bestTime != null && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...shadows.sm,
                  }}
                >
                  <Trophy size={18} color={colors.warning} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: typography.base,
                      color: colors.textSecondary,
                    }}
                  >
                    Deine Bestzeit
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                      color: colors.text,
                    }}
                  >
                    {formatTime(bestTime)}
                  </Text>
                </View>
              )}

              {/* Kartenquelle — Alle / Nur markierte / Nur Wackelkandidaten */}
              <CardSourcePicker
                value={source}
                onChange={setSource}
                allCount={cards.length}
                starredCount={starredCount}
                wobblyCount={wobblyCount}
              />
              {source !== "all" && playable.length < 2 && (
                <Text style={{ fontSize: typography.xs, color: colors.error }}>
                  Mindestens 2 Karten für diese Auswahl nötig.
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }} />

            {/* Start */}
            <TouchableOpacity
              onPress={() => startGame(playable, timed)}
              disabled={playable.length < 2}
              activeOpacity={0.85}
              style={{
                backgroundColor: playable.length < 2 ? colors.surfaceSecondary : colors.primary,
                paddingVertical: 16,
                borderRadius: radius.lg,
                alignItems: "center",
                ...shadows.md,
              }}
            >
              <Text
                style={{
                  color: playable.length < 2 ? colors.textTertiary : colors.textInverse,
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

  // Results
  if (phase === "finished") {
    const stars = errors === 0 ? 3 : errors <= 2 ? 2 : errors <= 4 ? 1 : 0;

    return (
      <>
        {screenHeader("Ergebnis", "Zurück")}
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
                backgroundColor: colors.successLight,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {timed ? (
                <Trophy size={40} color={colors.success} />
              ) : (
                <CheckCircle2 size={40} color={colors.success} />
              )}
            </View>

            {/* Headline: time in Challenge, "Geschafft!" in Übungsmodus */}
            <Text
              style={{
                fontSize: typography.xxxl,
                fontWeight: typography.extrabold,
                color: colors.text,
              }}
            >
              {timed ? formatTime(elapsed) : `Geschafft${displayName ? `, ${displayName}` : ""}!`}
            </Text>

            {timed && isNewBest && (
              <View
                style={{
                  backgroundColor: colors.warningLight,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.full ?? 999,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <Trophy size={16} color={colors.warning} />
                <Text
                  style={{
                    color: colors.warning,
                    fontWeight: typography.bold,
                    fontSize: typography.base,
                  }}
                >
                  Neue Bestzeit!
                </Text>
              </View>
            )}

            {/* Nur zeigen, wenn wirklich Punkte kamen. Eine zweite Runde mit
                denselben Karten am selben Tag bringt keine — dann steht hier
                nichts, statt „+0 Lernpunkte" zu behaupten. */}
            {earnedLp > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  backgroundColor: colors.successLight,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.full ?? 999,
                }}
              >
                <Zap size={15} color={colors.success} />
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.semibold,
                    color: colors.success,
                  }}
                >
                  +{earnedLp} Lernpunkte
                </Text>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  size={28}
                  color={i < stars ? colors.warning : colors.surfaceSecondary}
                  fill={i < stars ? colors.warning : "none"}
                />
              ))}
            </View>

            <View style={{ gap: spacing.xs, alignItems: "center" }}>
              <Text style={{ fontSize: typography.lg, color: colors.textSecondary }}>
                {gameCards.length} Paare zugeordnet
              </Text>
              <Text
                style={{
                  fontSize: typography.base,
                  color: errors === 0 ? colors.success : colors.error,
                }}
              >
                {errors === 0 ? "Keine Fehler!" : `${errors} Fehler`}
              </Text>
              {timed && !isNewBest && bestTime != null && (
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textTertiary,
                    marginTop: spacing.xs,
                  }}
                >
                  Bestzeit: {formatTime(bestTime)}
                </Text>
              )}
            </View>

            <View style={{ width: "100%", gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => startGame(playable, timed)}
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
                  style={{ color: colors.textInverse, fontWeight: typography.bold }}
                >
                  Alle nochmal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPhase("setup")}
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

  // Game board (playing)
  return (
    <>
      {screenHeader(deckTitle ?? "Zuordnen", "Abbrechen")}
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          {/* Stats bar */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              {timed ? (
                <>
                  <Timer size={16} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                      color: colors.text,
                    }}
                  >
                    {formatTime(elapsed)}
                  </Text>
                </>
              ) : (
                <>
                  <Puzzle size={16} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: typography.semibold,
                      color: colors.textSecondary,
                    }}
                  >
                    Üben
                  </Text>
                </>
              )}
            </View>
            <Text
              style={{
                fontSize: typography.sm,
                color: colors.textSecondary,
              }}
            >
              {matchedIds.size / 2} / {gameCards.length} Paare
            </Text>
            <Text
              style={{
                fontSize: typography.sm,
                color: errors > 0 ? colors.error : colors.textTertiary,
                fontWeight: typography.semibold,
              }}
            >
              {errors} Fehler
            </Text>
          </View>

          {/* Tiles grid (2 columns) */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.sm,
              justifyContent: "center",
            }}
          >
            {tiles.map((tile) => {
              const isMatched = matchedIds.has(tile.id);
              const isSelected = selectedTile?.id === tile.id;
              const isWrong = wrongPair?.includes(tile.id);
              const isFront = tile.side === "front";

              let bgColor: string = colors.surface;
              let borderColor: string = colors.border;
              let textColor: string = colors.text;

              if (isMatched) {
                bgColor = colors.successLight;
                borderColor = colors.success + "60";
                textColor = colors.success;
              } else if (isWrong) {
                bgColor = colors.errorLight;
                borderColor = colors.error;
                textColor = colors.error;
              } else if (isSelected) {
                bgColor = colors.primaryLight;
                borderColor = colors.primary;
                textColor = colors.primary;
              }

              return (
                <TouchableOpacity
                  key={tile.id}
                  onPress={() => handleTilePress(tile)}
                  disabled={isMatched}
                  activeOpacity={0.7}
                  style={{
                    width: tileWidth,
                    minHeight: 64,
                    backgroundColor: bgColor,
                    borderRadius: radius.md,
                    borderWidth: 2,
                    borderColor,
                    padding: spacing.md,
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: isMatched ? 0.5 : 1,
                    ...shadows.sm,
                  }}
                >
                  {/* Side indicator */}
                  <View
                    style={{
                      position: "absolute",
                      top: spacing.xs,
                      left: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isFront
                          ? colors.primary + "40"
                          : colors.accent + "40",
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: isSelected
                        ? typography.bold
                        : typography.medium,
                      color: textColor,
                      textAlign: "center",
                    }}
                    numberOfLines={3}
                  >
                    {tile.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
