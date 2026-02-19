import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  Layers,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit3,
  Plus,
  Play,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  getCourse,
  listDecksInCourse,
  updateCourseApi,
  deleteCourseApi,
  removeDeckFromCourse,
  getDueCards,
  type Deck,
} from "../../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { createDetailStackOptions } from "../../src/navigation/detailStackOptions";
import { useReviewSession } from "../../src/features/review/reviewSession";
import { useSessionStore } from "../../src/store/sessionStore";

export default function CourseDetailScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();

  const userId = useSessionStore((s) => s.userId);
  const start = useReviewSession((s) => s.start);

  const [currentTitle, setCurrentTitle] = useState(title ?? "");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingLearn, setStartingLearn] = useState(false);

  const courseId = id ?? "";

  const loadDecks = useCallback(async () => {
    if (!courseId) return;
    try {
      const [{ decks: fetched }, courseData] = await Promise.all([
        listDecksInCourse(courseId),
        currentTitle ? Promise.resolve(null) : getCourse(courseId).catch(() => null),
      ]);
      setDecks(fetched);
      if (courseData?.course?.title) {
        setCurrentTitle(courseData.course.title);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId, currentTitle]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDecks();
  };

  const handleRenameCourse = useCallback(() => {
    Alert.prompt(
      t("courseDetail.rename"),
      t("courseDetail.renamePrompt"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.save"),
          onPress: async (newTitle: string | undefined) => {
            if (!newTitle?.trim()) return;
            try {
              await updateCourseApi(courseId, { title: newTitle.trim() });
              setCurrentTitle(newTitle.trim());
            } catch {
              Alert.alert(t("common.error"), t("courseDetail.renameError"));
            }
          },
        },
      ],
      "plain-text",
      currentTitle,
      "default"
    );
  }, [courseId, currentTitle, t]);

  const handleDeleteCourse = useCallback(() => {
    Alert.alert(
      t("courseDetail.deleteTitle"),
      t("courseDetail.deleteMessage", { title: currentTitle }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCourseApi(courseId);
              router.back();
            } catch {
              Alert.alert(t("common.error"), t("courseDetail.deleteError"));
            }
          },
        },
      ]
    );
  }, [courseId, currentTitle, t, router]);

  const handleRemoveDeck = (deck: Deck) => {
    Alert.alert(
      t("courseDetail.removeDeckTitle"),
      t("courseDetail.removeDeckMessage", { title: deck.title }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("courseDetail.remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await removeDeckFromCourse(courseId, deck.id);
              setDecks((prev) => prev.filter((d) => d.id !== deck.id));
            } catch {
              Alert.alert(t("common.error"), t("courseDetail.removeDeckError"));
            }
          },
        },
      ]
    );
  };

  const handleLearnAll = useCallback(async () => {
    if (!userId || decks.length === 0) return;
    setStartingLearn(true);
    try {
      const { cards } = await getDueCards(userId);
      const deckIds = new Set(decks.map((d) => d.id));
      const filtered = cards.filter((c) => deckIds.has(c.deckId));
      if (filtered.length === 0) {
        Alert.alert(t("learn.noDueCards"), t("learn.noDueCardsMessage"));
        return;
      }
      start(filtered.map((c) => ({ id: c.id, front: c.front, back: c.back, starred: c.starred })));
      router.push("/(tabs)/learn");
    } catch {
      Alert.alert(t("common.error"), t("learn.loadError"));
    } finally {
      setStartingLearn(false);
    }
  }, [userId, decks, t, start, router]);

  const handleMoreMenu = useCallback(() => {
    Alert.alert(currentTitle, "", [
      { text: t("courseDetail.rename"), onPress: handleRenameCourse },
      { text: t("common.delete"), style: "destructive", onPress: handleDeleteCourse },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }, [currentTitle, t, handleRenameCourse, handleDeleteCourse]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createDetailStackOptions({
        title: currentTitle,
        backTitle: t("library.title"),
        colors,
      }),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleMoreMenu}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
        >
          <MoreVertical size={20} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, currentTitle, t, colors, handleMoreMenu]);

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.lg }}>
          {/* Course header card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: spacing.lg,
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <BookOpen size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                  {currentTitle}
                </Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                  {decks.length} {decks.length === 1 ? t("deckDetails.card") : "Decks"}
                </Text>
              </View>
            </View>
          </View>

          {/* Learn all button */}
          {decks.length > 0 && (
            <TouchableOpacity
              onPress={handleLearnAll}
              disabled={startingLearn}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                marginBottom: spacing.lg,
                opacity: startingLearn ? 0.7 : 1,
              }}
            >
              {startingLearn ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Play size={16} color="#fff" fill="#fff" />
              )}
              <Text style={{ color: "#fff", fontWeight: typography.semibold, fontSize: typography.base }}>
                {t("courseDetail.learnAll")}
              </Text>
            </TouchableOpacity>
          )}

          {/* Section header */}
          <Text
            style={{
              fontSize: typography.sm,
              fontWeight: typography.semibold,
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: spacing.sm,
            }}
          >
            {t("courseDetail.decksInCourse")}
          </Text>

          {/* Deck list */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={{ gap: spacing.sm + 2, paddingBottom: spacing.xxl }}
            >
              {decks.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: spacing.md }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.surfaceSecondary,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Layers size={28} color={colors.textTertiary} />
                  </View>
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    {t("courseDetail.emptyDecks")}
                  </Text>
                </View>
              ) : (
                decks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    onPress={() => router.push(`/deck/${deck.id}?title=${encodeURIComponent(deck.title)}`)}
                    onLongPress={() => handleRemoveDeck(deck)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      ...shadows.sm,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.sm }}>
                        <Layers size={18} color={colors.primary} />
                        <Text
                          style={{
                            fontWeight: typography.semibold,
                            fontSize: typography.base,
                            flex: 1,
                            color: colors.text,
                          }}
                        >
                          {deck.title}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
      </View>
    </SafeAreaView>
  );
}
