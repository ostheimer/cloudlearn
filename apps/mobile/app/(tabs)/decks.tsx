import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  ScanLine,
  Search,
  Layers,
  ChevronRight,
  FolderOpen,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../../src/store/sessionStore";
import {
  listDecks,
  getDueCards,
  searchCards,
  type CardSearchResult,
  updateDeck,
  deleteDeck,
  listFolders,
  createFolder,
  updateFolderApi,
  deleteFolderApi,
  type Deck,
  type Folder,
} from "../../src/lib/api";
import { searchDecks } from "../../src/lib/searchDecks";
import { buildDeckCountLabel } from "../../src/lib/deckCountLabel";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { buildLibraryFolderRoute } from "../../src/navigation/libraryRoutes";
import { AuthPromptCard } from "../../src/components/AuthPromptCard";
import TextPromptModal from "../../src/components/TextPromptModal";

type TabKey = "decks" | "folders";

/**
 * Welches Eingabe-Fenster gerade offen ist. Früher lief das über den
 * Eingabe-Alert von iOS — auf Android passierte dabei schlicht nichts (#396).
 */
type PromptState =
  | { kind: "renameDeck"; deck: Deck }
  | { kind: "createFolder" }
  | { kind: "renameFolder"; folder: Folder };

export default function LibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);

  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <AuthPromptCard
            title="Decks brauchen ein Konto"
            body="Decks und Ordner werden an dein Konto gebunden, damit wir sie sicher speichern und auf mehreren Geräten synchronisieren können."
            onPress={() => router.push("/auth")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return <AuthenticatedLibraryScreen userId={userId} />;
}

function AuthenticatedLibraryScreen({ userId }: { userId: string }) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabKey>("decks");
  const [query, setQuery] = useState("");

  // Decks state
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksRefreshing, setDecksRefreshing] = useState(false);
  const [decksError, setDecksError] = useState(false);
  // Due cards per deck ("N fällig" badge on each deck row).
  const [dueByDeck, setDueByDeck] = useState<Record<string, number>>({});

  // Folders state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersRefreshing, setFoldersRefreshing] = useState(false);
  const [foldersError, setFoldersError] = useState(false);

  // Offenes Eingabe-Fenster (Anlegen / Umbenennen). null = keines.
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  // --- Load data ---

  const loadDecks = useCallback(async () => {
    if (!userId) {
      setDecks([]);
      setDecksLoading(false);
      setDecksRefreshing(false);
      return;
    }
    setDecksError(false);
    try {
      // The badge is best-effort: a failing due lookup must not break the list.
      const [{ decks: fetched }, due] = await Promise.all([
        listDecks(userId),
        getDueCards(userId).catch(() => ({ cards: [] })),
      ]);
      setDecks(fetched);
      const counts: Record<string, number> = {};
      for (const card of due.cards) {
        counts[card.deckId] = (counts[card.deckId] ?? 0) + 1;
      }
      setDueByDeck(counts);
    } catch {
      // Distinguish a load failure (offline / server error) from a genuinely
      // empty library so we can offer a retry instead of "noch keine Decks".
      setDecksError(true);
    } finally {
      setDecksLoading(false);
      setDecksRefreshing(false);
    }
  }, [userId]);

  const loadFolders = useCallback(async () => {
    if (!userId) {
      setFolders([]);
      setFoldersLoading(false);
      setFoldersRefreshing(false);
      return;
    }

    setFoldersError(false);
    try {
      const { folders: fetched } = await listFolders();
      setFolders(fetched);
    } catch {
      setFoldersError(true);
    } finally {
      setFoldersLoading(false);
      setFoldersRefreshing(false);
    }
  }, [userId]);

  // Reload whenever the tab regains focus so returning to the library (e.g.
  // after creating or editing a deck elsewhere) shows fresh data — not just on
  // first mount. The load callbacks are keyed to userId, so this focus callback
  // is stable and won't loop; pull-to-refresh keeps working independently.
  useFocusEffect(
    useCallback(() => {
      loadDecks();
      loadFolders();
    }, [loadDecks, loadFolders])
  );

  const filteredDecks = useMemo(() => searchDecks(decks, query), [decks, query]);

  // Card search: from 2+ characters the query also searches card fronts/backs
  // server-side (debounced so we don't fire a request per keystroke).
  const [cardResults, setCardResults] = useState<CardSearchResult[]>([]);
  const [cardSearchLoading, setCardSearchLoading] = useState(false);
  useEffect(() => {
    const term = query.trim();
    if (activeTab !== "decks" || term.length < 2 || !userId) {
      setCardResults([]);
      setCardSearchLoading(false);
      return;
    }
    setCardSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCards(term)
        .then((res) => {
          if (!cancelled) setCardResults(res.results);
        })
        .catch(() => {
          // Best-effort: a failing card search must not disturb the deck list.
          if (!cancelled) setCardResults([]);
        })
        .finally(() => {
          if (!cancelled) setCardSearchLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeTab, userId]);

  const filteredFolders = useMemo(
    () =>
      query.trim()
        ? folders.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()))
        : folders,
    [folders, query]
  );

  // --- Deck actions ---


  const handleDeckLongPress = (deck: Deck) => {
    Alert.alert(deck.title, t("library.deckLongPressPrompt"), [
      {
        text: t("library.rename"),
        onPress: () => setPrompt({ kind: "renameDeck", deck }),
      },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("deckAction.deleteTitle"), t("deckAction.deleteMessage", { title: deck.title }), [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("common.delete"),
              style: "destructive",
              onPress: async () => {
                try {
                  await deleteDeck(deck.id);
                  setDecks((prev) => prev.filter((d) => d.id !== deck.id));
                } catch {
                  Alert.alert(t("common.error"), t("deckAction.deleteError"));
                }
              },
            },
          ]);
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  // --- Folder actions ---

  const handleCreateFolder = () => setPrompt({ kind: "createFolder" });

  const handleFolderLongPress = (folder: Folder) => {
    Alert.alert(folder.title, t("library.folderLongPressPrompt"), [
      {
        text: t("library.rename"),
        onPress: () => setPrompt({ kind: "renameFolder", folder }),
      },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          Alert.alert(
            t("library.deleteFolderTitle"),
            t("library.deleteFolderMessage", { title: folder.title }),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("common.delete"),
                style: "destructive",
                onPress: async () => {
                  try {
                    await deleteFolderApi(folder.id);
                    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
                  } catch {
                    Alert.alert(t("common.error"), t("library.deleteFolderError"));
                  }
                },
              },
            ]
          );
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  // --- Eingabe-Fenster ---

  // Beschriftung + Vorbelegung je Fall. Entspricht 1:1 den früheren
  // Alert-Argumenten (Titel, Meldung, Knopftext, Vorgabewert).
  const promptConfig = (() => {
    if (!prompt) return null;
    switch (prompt.kind) {
      case "renameDeck":
        return {
          icon: Layers,
          title: t("library.renameDeck"),
          label: t("library.renamePrompt", { title: prompt.deck.title }),
          initialValue: prompt.deck.title,
          confirmLabel: t("common.save"),
        };
      case "createFolder":
        return {
          icon: FolderOpen,
          title: t("library.newFolder"),
          label: t("library.newFolderPrompt"),
          initialValue: "",
          confirmLabel: t("library.create"),
        };
      case "renameFolder":
        return {
          icon: FolderOpen,
          title: t("library.renameFolder"),
          label: t("library.renamePrompt", { title: prompt.folder.title }),
          initialValue: prompt.folder.title,
          confirmLabel: t("common.save"),
        };
    }
  })();

  // Das Fenster schliesst beim Bestätigen — wie zuvor der Alert — und die
  // eigentliche Arbeit läuft danach. Jeder Fall verhält sich exakt wie vorher.
  const handlePromptSubmit = async (value: string) => {
    if (!prompt) return;
    const current = prompt;
    setPrompt(null);
    switch (current.kind) {
      case "renameDeck": {
        if (!value.trim()) return;
        try {
          await updateDeck(current.deck.id, { title: value.trim() });
          loadDecks();
        } catch {
          Alert.alert(t("common.error"), t("library.renameDeckError"));
        }
        return;
      }
      case "createFolder": {
        if (!value.trim() || !userId) return;
        try {
          await createFolder(value.trim());
          loadFolders();
        } catch {
          Alert.alert(t("common.error"), t("folder.createError"));
        }
        return;
      }
      case "renameFolder": {
        if (!value.trim()) return;
        try {
          await updateFolderApi(current.folder.id, { title: value.trim() });
          loadFolders();
        } catch {
          Alert.alert(t("common.error"), t("library.renameFolderError"));
        }
        return;
      }
    }
  };

  // --- Navigation ---

  const handleDeckTap = (deck: Deck) => {
    router.push(`/deck/${deck.id}?title=${encodeURIComponent(deck.title)}`);
  };

  const handleFolderTap = (folder: Folder) => {
    router.push(buildLibraryFolderRoute(folder.id, folder.title));
  };

  // --- Tab config ---

  const tabs: { key: TabKey; label: string }[] = [
    { key: "decks", label: t("library.tabDecks") },
    { key: "folders", label: t("library.tabFolders") },
  ];

  const isLoading = activeTab === "decks" ? decksLoading : foldersLoading;
  const isRefreshing = activeTab === "decks" ? decksRefreshing : foldersRefreshing;
  const isError = activeTab === "decks" ? decksError : foldersError;

  const onRefresh = () => {
    if (activeTab === "decks") {
      setDecksRefreshing(true);
      loadDecks();
    } else {
      setFoldersRefreshing(true);
      loadFolders();
    }
  };

  // Re-run the active tab's load after a load failure, showing the spinner.
  const retryActive = () => {
    if (activeTab === "decks") {
      setDecksLoading(true);
      loadDecks();
    } else {
      setFoldersLoading(true);
      loadFolders();
    }
  };

  // Decks are made by scanning, not by naming: a deck without cards is a dead
  // end, so this jumps straight to the scan flow, which creates the deck itself.
  // Folders are just containers, so a name is all they need.
  const handleCreate = () => {
    if (activeTab === "decks") router.push("/(tabs)/scan");
    else handleCreateFolder();
  };

  // --- Render helpers ---

  const renderDeckItem = (deck: Deck) => (
    <TouchableOpacity
      key={deck.id}
      onPress={() => handleDeckTap(deck)}
      onLongPress={() => handleDeckLongPress(deck)}
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
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: typography.semibold, fontSize: typography.base, color: colors.text }}>
              {deck.title}
            </Text>
            {deck.cardCount !== undefined && (
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: 1 }}>
                {/* Bild-Karten zählen nicht als „Karten" (eigener Modus), dürfen
                    aber nicht verschwinden: sonst meldet ein reines Bilder-Deck
                    „0 Karten" und wirkt kaputt. Gleiche Regel wie im Web. */}
                {buildDeckCountLabel(deck.cardCount, deck.imageCardCount) ?? t("library.noCards")}
              </Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {(dueByDeck[deck.id] ?? 0) > 0 && (
            <View
              style={{
                backgroundColor: colors.primaryLight,
                borderRadius: radius.full ?? 999,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: typography.xs,
                  fontWeight: typography.bold,
                  color: colors.primary,
                }}
              >
                {dueByDeck[deck.id]} fällig
              </Text>
            </View>
          )}
          <ChevronRight size={18} color={colors.textTertiary} />
        </View>
      </View>
      {deck.tags.length > 0 && (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, marginLeft: 26 }}>
          {deck.tags.map((tag) => (
            <Text
              key={tag}
              style={{
                fontSize: typography.xs,
                backgroundColor: colors.surfaceSecondary,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.sm,
                color: colors.textTertiary,
                overflow: "hidden",
              }}
            >
              {tag}
            </Text>
          ))}
        </View>
      )}
      <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: spacing.sm, marginLeft: 26 }}>
        {new Date(deck.createdAt).toLocaleDateString("de")}
      </Text>
    </TouchableOpacity>
  );

  const renderFolderItem = (folder: Folder) => (
    <TouchableOpacity
      key={folder.id}
      onPress={() => handleFolderTap(folder)}
      onLongPress={() => handleFolderLongPress(folder)}
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
              backgroundColor: folder.color || colors.warningLight,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <FolderOpen size={14} color={folder.color ? "#fff" : colors.warning} />
          </View>
          <Text style={{ fontWeight: typography.semibold, fontSize: typography.base, flex: 1, color: colors.text }}>
            {folder.title}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: typography.xs, color: colors.textTertiary, marginTop: spacing.sm, marginLeft: 36 }}>
        {new Date(folder.createdAt).toLocaleDateString("de")}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = (icon: React.ReactNode, message: string) => (
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
        {icon}
      </View>
      <Text style={{ fontSize: typography.base, color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>
        {message}
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={{ alignItems: "center", paddingTop: 40, gap: spacing.lg, paddingHorizontal: spacing.xl }}>
      <Text style={{ fontSize: typography.base, color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>
        {t("common.loadError")}
      </Text>
      <TouchableOpacity
        onPress={retryActive}
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
    </View>
  );

  // Card hits for the current search, shown above the deck list.
  const renderCardResults = () => {
    const term = query.trim();
    if (term.length < 2) return null;
    if (!cardSearchLoading && cardResults.length === 0) return null;
    return (
      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Text
          style={{
            fontSize: typography.xs,
            color: colors.textTertiary,
            fontWeight: typography.semibold,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {cardSearchLoading
            ? "Karten werden durchsucht…"
            : `Karten · ${cardResults.length} Treffer`}
        </Text>
        {cardResults.map((hit) => (
          <TouchableOpacity
            key={hit.cardId}
            onPress={() =>
              router.push(
                `/deck/${hit.deckId}?title=${encodeURIComponent(hit.deckTitle)}`
              )
            }
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadows.sm,
            }}
          >
            <Text
              style={{
                fontSize: typography.sm,
                fontWeight: typography.semibold,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {hit.front}
            </Text>
            <Text
              style={{ fontSize: typography.sm, color: colors.textSecondary, marginTop: 1 }}
              numberOfLines={1}
            >
              {hit.back}
            </Text>
            <Text
              style={{ fontSize: typography.xs, color: colors.primary, marginTop: 4 }}
              numberOfLines={1}
            >
              in: {hit.deckTitle}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderList = () => {
    if (activeTab === "decks") {
      const cardSection = renderCardResults();
      if (filteredDecks.length === 0 && !cardSection) {
        return renderEmpty(
          <Layers size={28} color={colors.textTertiary} />,
          decks.length === 0 ? t("library.emptyDecks") : t("library.noMatchDecks")
        );
      }
      return (
        <>
          {cardSection}
          {filteredDecks.map(renderDeckItem)}
        </>
      );
    }

    if (filteredFolders.length === 0) {
      return renderEmpty(
        <FolderOpen size={28} color={colors.textTertiary} />,
        folders.length === 0 ? t("library.emptyFolders") : t("library.noMatchFolders")
      );
    }
    return filteredFolders.map(renderFolderItem);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
            {t("library.title")}
          </Text>
          <TouchableOpacity
            onPress={handleCreate}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            {activeTab === "decks" ? (
              <ScanLine size={16} color={colors.textInverse} strokeWidth={3} />
            ) : (
              <Plus size={16} color={colors.textInverse} strokeWidth={3} />
            )}
            <Text style={{ color: colors.textInverse, fontWeight: typography.bold, fontSize: typography.base }}>
              {activeTab === "decks" ? t("common.scan") : t("common.new")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Segmented Control */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
            padding: 3,
          }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => { setActiveTab(tab.key); setQuery(""); }}
              activeOpacity={0.8}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.sm,
                alignItems: "center",
                backgroundColor: activeTab === tab.key ? colors.surface : "transparent",
                ...(activeTab === tab.key ? shadows.sm : {}),
              }}
            >
              <Text
                style={{
                  fontSize: typography.sm,
                  fontWeight: activeTab === tab.key ? typography.bold : typography.medium,
                  color: activeTab === tab.key ? colors.text : colors.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={{ position: "relative" }}>
          <Search
            size={18}
            color={colors.textTertiary}
            style={{ position: "absolute", left: 14, top: 14, zIndex: 1 }}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("library.searchPlaceholder")}
            placeholderTextColor={colors.textTertiary}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              paddingLeft: 42,
              paddingRight: spacing.md,
              fontSize: typography.base,
              backgroundColor: colors.surface,
              color: colors.text,
            }}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isError ? (
          <ScrollView
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ gap: spacing.sm + 2, paddingBottom: spacing.xxl }}
          >
            {renderError()}
          </ScrollView>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ gap: spacing.sm + 2, paddingBottom: spacing.xxl }}
          >
            {renderList()}

            {((activeTab === "decks" && filteredDecks.length > 0) ||
              (activeTab === "folders" && filteredFolders.length > 0)) && (
              <Text
                style={{
                  fontSize: typography.xs,
                  color: colors.textTertiary,
                  textAlign: "center",
                  marginTop: spacing.sm,
                }}
              >
                {t("library.longPressHint")}
              </Text>
            )}
          </ScrollView>
        )}
      </View>

      {/* Nur bei offenem Fenster eingehängt: so springt der Tastatur-Fokus
          (autoFocus) bei JEDEM Öffnen wieder ins Feld. */}
      {promptConfig ? (
        <TextPromptModal
          visible
          icon={promptConfig.icon}
          title={promptConfig.title}
          label={promptConfig.label}
          initialValue={promptConfig.initialValue}
          confirmLabel={promptConfig.confirmLabel}
          onCancel={() => setPrompt(null)}
          onSubmit={handlePromptSubmit}
        />
      ) : null}
    </SafeAreaView>
  );
}
