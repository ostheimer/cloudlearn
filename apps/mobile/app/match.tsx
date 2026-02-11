import { useEffect, useMemo, useState, useRef } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import {
  Trophy,
  RotateCcw,
  Timer,
  Zap,
  HelpCircle,
} from "lucide-react-native";
import { listCardsInDeck, type Card } from "../src/lib/api";
import { colors, spacing, radius, typography, shadows } from "../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

export default function MatchScreen() {
  const { deckId, deckTitle } = useLocalSearchParams<{
    deckId: string;
    deckTitle: string;
  }>();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [gameCards, setGameCards] = useState<Card[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load cards
  useEffect(() => {
    if (!deckId) return;
    (async () => {
      try {
        const { cards: fetched } = await listCardsInDeck(deckId);
        setCards(fetched);
        startGame(fetched);
      } catch {
        // Error
      } finally {
        setLoading(false);
      }
    })();
  }, [deckId]);

  const startGame = (allCards: Card[]) => {
    const count = Math.min(6, allCards.length);
    const selected = shuffle(allCards).slice(0, count);
    setGameCards(selected);

    // Create tiles: one "front" tile + one "back" tile per card
    const newTiles: Tile[] = [];
    for (const card of selected) {
      newTiles.push({
        id: `${card.id}-front`,
        text: card.front,
        cardId: card.id,
        side: "front",
      });
      newTiles.push({
        id: `${card.id}-back`,
        text: card.back,
        cardId: card.id,
        side: "back",
      });
    }
    setTiles(shuffle(newTiles));
    setSelectedTile(null);
    setMatchedIds(new Set());
    setWrongPair(null);
    setErrors(0);
    setElapsed(0);
    setFinished(false);

    // Start timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
  };

  // Stop timer when finished
  useEffect(() => {
    if (finished && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [finished]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Check if all matched
  useEffect(() => {
    if (
      tiles.length > 0 &&
      matchedIds.size === tiles.length &&
      !finished
    ) {
      setFinished(true);
    }
  }, [matchedIds, tiles.length, finished]);

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

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Match",
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

  if (cards.length < 2) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Match",
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
            Mindestens 2 Karten nötig für das Match-Spiel.
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
            <Text
              style={{
                color: colors.textInverse,
                fontWeight: typography.bold,
              }}
            >
              Zurück
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  // Results
  if (finished) {
    const stars =
      errors === 0 ? 3 : errors <= 2 ? 2 : errors <= 4 ? 1 : 0;

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
          style={{
            flex: 1,
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.xxl,
            gap: spacing.xl,
          }}
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
            <Trophy size={40} color={colors.success} />
          </View>

          <Text
            style={{
              fontSize: typography.xxxl,
              fontWeight: typography.extrabold,
              color: colors.text,
            }}
          >
            {formatTime(elapsed)}
          </Text>

          {/* Stars */}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <Zap
                key={i}
                size={28}
                color={i < stars ? colors.warning : colors.surfaceSecondary}
                fill={i < stars ? colors.warning : "none"}
              />
            ))}
          </View>

          <View style={{ gap: spacing.xs, alignItems: "center" }}>
            <Text
              style={{
                fontSize: typography.lg,
                color: colors.textSecondary,
              }}
            >
              {gameCards.length} Paare zugeordnet
            </Text>
            <Text
              style={{
                fontSize: typography.base,
                color: errors === 0 ? colors.success : colors.error,
              }}
            >
              {errors === 0
                ? "Keine Fehler!"
                : `${errors} Fehler`}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              width: "100%",
            }}
          >
            <TouchableOpacity
              onPress={() => startGame(cards)}
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
        </SafeAreaView>
      </>
    );
  }

  // Game board
  return (
    <>
      <Stack.Screen
        options={{
          title: deckTitle ?? "Match",
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
