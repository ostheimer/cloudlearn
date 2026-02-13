import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
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
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  listDecksInCourse,
  updateCourseApi,
  deleteCourseApi,
  removeDeckFromCourse,
  type Deck,
} from "../../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

export default function CourseDetailScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();

  const [currentTitle, setCurrentTitle] = useState(title ?? "");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const courseId = id ?? "";

  const loadDecks = useCallback(async () => {
    if (!courseId) return;
    try {
      const { decks: fetched } = await listDecksInCourse(courseId);
      setDecks(fetched);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDecks();
  };

  const handleRenameCourse = () => {
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
  };

  const handleDeleteCourse = () => {
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
  };

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

  const handleMoreMenu = () => {
    Alert.alert(currentTitle, "", [
      { text: t("courseDetail.rename"), onPress: handleRenameCourse },
      { text: t("common.delete"), style: "destructive", onPress: handleDeleteCourse },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: currentTitle,
          headerBackTitle: t("library.title"),
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <TouchableOpacity onPress={handleMoreMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MoreVertical size={22} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
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
    </>
  );
}
