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
  FolderOpen,
  Layers,
  ChevronRight,
  MoreVertical,
  Folder as FolderIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  getFolder,
  listDecksInFolder,
  listFolders,
  updateFolderApi,
  deleteFolderApi,
  removeDeckFromFolder,
  type Deck,
  type Folder,
} from "../../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { createDetailStackOptions } from "../../src/navigation/detailStackOptions";
import { buildLibraryFolderRoute } from "../../src/navigation/libraryRoutes";

export default function FolderDetailScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();

  const [currentTitle, setCurrentTitle] = useState(title ?? "");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const folderId = id ?? "";

  const loadContent = useCallback(async () => {
    if (!folderId) return;
    try {
      const [decksRes, foldersRes, folderData] = await Promise.all([
        listDecksInFolder(folderId),
        listFolders(),
        currentTitle ? Promise.resolve(null) : getFolder(folderId).catch(() => null),
      ]);
      setDecks(decksRes.decks);
      // Filter subfolders (children of this folder)
      setSubfolders(foldersRes.folders.filter((f) => f.parentId === folderId));
      if (folderData?.folder?.title) {
        setCurrentTitle(folderData.folder.title);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folderId, currentTitle]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const onRefresh = () => {
    setRefreshing(true);
    loadContent();
  };

  const handleRenameFolder = useCallback(() => {
    Alert.prompt(
      t("folderDetail.rename"),
      t("folderDetail.renamePrompt"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.save"),
          onPress: async (newTitle: string | undefined) => {
            if (!newTitle?.trim()) return;
            try {
              await updateFolderApi(folderId, { title: newTitle.trim() });
              setCurrentTitle(newTitle.trim());
            } catch {
              Alert.alert(t("common.error"), t("folderDetail.renameError"));
            }
          },
        },
      ],
      "plain-text",
      currentTitle,
      "default"
    );
  }, [folderId, currentTitle, t]);

  const handleDeleteFolder = useCallback(() => {
    Alert.alert(
      t("folderDetail.deleteTitle"),
      t("folderDetail.deleteMessage", { title: currentTitle }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFolderApi(folderId);
              router.back();
            } catch {
              Alert.alert(t("common.error"), t("folderDetail.deleteError"));
            }
          },
        },
      ]
    );
  }, [folderId, currentTitle, t, router]);

  const handleRemoveDeck = (deck: Deck) => {
    Alert.alert(
      t("folderDetail.removeDeckTitle"),
      t("folderDetail.removeDeckMessage", { title: deck.title }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("folderDetail.remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await removeDeckFromFolder(folderId, deck.id);
              setDecks((prev) => prev.filter((d) => d.id !== deck.id));
            } catch {
              Alert.alert(t("common.error"), t("folderDetail.removeDeckError"));
            }
          },
        },
      ]
    );
  };

  const handleMoreMenu = useCallback(() => {
    Alert.alert(currentTitle, "", [
      { text: t("folderDetail.rename"), onPress: handleRenameFolder },
      { text: t("common.delete"), style: "destructive", onPress: handleDeleteFolder },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }, [currentTitle, t, handleRenameFolder, handleDeleteFolder]);

  const totalItems = subfolders.length + decks.length;

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
          {/* Folder header card */}
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
                  backgroundColor: colors.warningLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <FolderOpen size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.lg, fontWeight: typography.bold, color: colors.text }}>
                  {currentTitle}
                </Text>
                <Text style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 }}>
                  {totalItems} {t("folderDetail.items")}
                </Text>
              </View>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={{ gap: spacing.sm + 2, paddingBottom: spacing.xxl }}
            >
              {/* Subfolders */}
              {subfolders.length > 0 && (
                <>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: typography.semibold,
                      color: colors.textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: spacing.xs,
                    }}
                  >
                    {t("folderDetail.subfolders")}
                  </Text>
                  {subfolders.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => router.push(buildLibraryFolderRoute(sub.id, sub.title))}
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
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              backgroundColor: colors.warningLight,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <FolderIcon size={14} color={colors.warning} />
                          </View>
                          <Text
                            style={{
                              fontWeight: typography.semibold,
                              fontSize: typography.base,
                              flex: 1,
                              color: colors.text,
                            }}
                          >
                            {sub.title}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.textTertiary} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Decks section header */}
              {(subfolders.length > 0 || decks.length > 0) && (
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.semibold,
                    color: colors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginTop: subfolders.length > 0 ? spacing.md : 0,
                    marginBottom: spacing.xs,
                  }}
                >
                  {t("folderDetail.decksSection")}
                </Text>
              )}

              {/* Decks */}
              {decks.length === 0 && subfolders.length === 0 ? (
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
                    <FolderOpen size={28} color={colors.textTertiary} />
                  </View>
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    {t("folderDetail.emptyFolder")}
                  </Text>
                </View>
              ) : (
                decks.map((deck) => (
                  <TouchableOpacity
                    key={deck.id}
                    onPress={() =>
                      router.push(`/deck/${deck.id}?title=${encodeURIComponent(deck.title)}`)
                    }
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
