import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
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
  ArrowUpDown,
  Archive as ArchiveIcon,
  Archive,
  Play,
  Pencil,
  FolderPlus,
  Copy,
  Share2,
  Trash2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../../src/store/sessionStore";
import {
  listDecks,
  setDeckArchived,
  getDueCountsByDeck,
  getLastLearnedByDeck,
  searchCards,
  type CardSearchResult,
  updateDeck,
  deleteDeck,
  createDeck,
  duplicateDeck,
  shareDeck,
  listFolders,
  createFolder,
  updateFolderApi,
  deleteFolderApi,
  getLpBalance,
  type Deck,
  type Folder,
} from "../../src/lib/api";
import { searchDecks } from "../../src/lib/searchDecks";
import { descendantFolders, folderDeleteQuestion } from "../../src/lib/folders";
import { buildDeckCountLabel } from "../../src/lib/deckCountLabel";
import { deckSlotsSummary, isDeckLimitReached } from "../../src/lib/importLimits";
import { usageFromBalanceResponse, useUsageStore } from "../../src/store/usageStore";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { buildLibraryFolderRoute } from "../../src/navigation/libraryRoutes";
import { AuthPromptCard } from "../../src/components/AuthPromptCard";
import TextPromptModal from "../../src/components/TextPromptModal";
import ActionSheet, { type ActionSheetItem } from "../../src/components/ActionSheet";
import FolderPickerModal from "../../src/components/FolderPickerModal";
import { TITLE_MAX_LENGTH } from "../../src/lib/titleLimit";
import {
  DEFAULT_FOLDER_SORT,
  loadFolderSort,
  saveFolderSort,
  sortFolders,
  type FolderSort,
} from "../../src/lib/folderSort";
import {
  DEFAULT_DECK_SORT,
  loadDeckSort,
  saveDeckSort,
  sortDecks,
  type DeckSort,
} from "../../src/lib/deckSort";

type TabKey = "decks" | "folders";

/**
 * Welches Eingabe-Fenster gerade offen ist. Früher lief das über den
 * Eingabe-Alert von iOS — auf Android passierte dabei schlicht nichts (#396).
 */
type PromptState =
  | { kind: "renameDeck"; deck: Deck }
  | { kind: "createDeck" }
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

  // Wie viele Decks im Archiv liegen (#614) — nur für den Einstieg unter der
  // Liste. Ohne archivierte Decks steht dort nichts.
  const [archivedCount, setArchivedCount] = useState(0);

  // Folders state
  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [foldersRefreshing, setFoldersRefreshing] = useState(false);
  const [foldersError, setFoldersError] = useState(false);

  // Offenes Eingabe-Fenster (Anlegen / Umbenennen). null = keines.
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  // Deck-Menü und Ordner-Auswahl der Bibliothek (#571 Teil C).
  const [deckMenu, setDeckMenu] = useState<Deck | null>(null);
  const [folderPickerDeck, setFolderPickerDeck] = useState<Deck | null>(null);

  // Füllstand „19 von 20 Decks belegt" (#611). `maxDecks` ist `null`, solange
  // der Server die Grenzen nicht geliefert hat (#603) — dann steht hier nichts.
  const maxDecks = useUsageStore((state) => state.maxDecks);
  const setUsage = useUsageStore((state) => state.setUsage);
  // Belegt sind AKTIVE + ARCHIVIERTE Decks (#614): ein archiviertes Deck ist
  // nicht weg und zählt weiter gegen die Grenze. Nur die sichtbaren zu zählen
  // hieße „18 von 20 belegt" zu melden und trotzdem abgelehnt zu werden.
  const usedDeckSlots = decks.length + archivedCount;
  const deckSlotsLabel = deckSlotsSummary(decksLoading ? null : usedDeckSlots, maxDecks);
  const decksAtLimit = isDeckLimitReached(usedDeckSlots, maxDecks);

  // Grenzen einmalig nachladen, falls dieser Tab der erste ist. Über die
  // Startseite hat das LP-Abzeichen sie längst geholt — dann kein Aufruf.
  useEffect(() => {
    if (maxDecks !== null) return;
    void getLpBalance()
      .then((res) => setUsage(usageFromBalanceResponse(res)))
      .catch(() => {
        // Ohne Grenzen bleibt der Füllstand aus — nichts behaupten (#603).
      });
  }, [maxDecks, setUsage]);

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
      // Gezählt wird auf dem Server (#612): getDueCards überträgt den ganzen
      // Rückstand mit Kartentext und wird ab 1000 Karten still gekappt.
      const [{ decks: fetched }, { dueByDeck: due }] = await Promise.all([
        listDecks(userId),
        getDueCountsByDeck().catch(() => ({ dueByDeck: {} })),
      ]);
      setDecks(fetched);
      setDueByDeck(due);
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

  // Archiv-Zähler beim Fokus mitziehen: kommt man vom Archiv zurück, stimmt
  // die Zahl sonst nicht mehr.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listDecks(userId, { archived: true })
        .then(({ decks: archived }) => {
          if (active) setArchivedCount(archived.length);
        })
        .catch(() => {
          // Ohne Zahl bleibt der Einstieg aus — nichts behaupten.
        });
      return () => {
        active = false;
      };
    }, [userId])
  );

  // Deck-Reihenfolge (#614): Neueste (Voreinstellung, die bisherige Ordnung) /
  // A–Z / Fällige zuerst / Zuletzt gelernt. Web-Gegenstück: deck-sort.ts.
  const [deckSort, setDeckSort] = useState<DeckSort>(DEFAULT_DECK_SORT);
  useEffect(() => {
    let active = true;
    void loadDeckSort().then((stored) => {
      if (active) setDeckSort(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  // Nur „Zuletzt gelernt" braucht die Zeitstempel — erst holen, wenn diese
  // Reihenfolge gewählt ist, und dann einmal statt bei jedem Umschalten.
  const [lastLearnedByDeck, setLastLearnedByDeck] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (deckSort !== "learned" || lastLearnedByDeck !== null) return;
    let active = true;
    void getLastLearnedByDeck()
      .then(({ lastLearnedByDeck: fetched }) => {
        if (active) setLastLearnedByDeck(fetched);
      })
      .catch(() => {
        // Scheitert die Abfrage, wird nach Titel weiter sortiert statt die
        // Liste zu verweigern.
        if (active) setLastLearnedByDeck({});
      });
    return () => {
      active = false;
    };
  }, [deckSort, lastLearnedByDeck]);

  const filteredDecks = useMemo(
    () =>
      sortDecks(searchDecks(decks, query), deckSort, {
        dueByDeck,
        lastLearnedByDeck: lastLearnedByDeck ?? {},
      }),
    [decks, query, deckSort, dueByDeck, lastLearnedByDeck]
  );

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

  // Reihenfolge ist umschaltbar (#612): A–Z (Voreinstellung) oder neueste
  // zuerst. Vorher zeigte die App nur die Server-Reihenfolge, das Web nur
  // alphabetisch — dasselbe Konto, zwei Reihenfolgen.
  const [folderSort, setFolderSort] = useState<FolderSort>(DEFAULT_FOLDER_SORT);
  useEffect(() => {
    let active = true;
    void loadFolderSort().then((stored) => {
      if (active) setFolderSort(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredFolders = useMemo(() => {
    const sorted = sortFolders(folders, folderSort);
    return query.trim()
      ? sorted.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()))
      : sorted;
  }, [folders, query, folderSort]);

  // --- Deck actions ---


  const archiveDeck = async (deck: Deck) => {
    setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    setArchivedCount((n) => n + 1);
    try {
      await setDeckArchived(deck.id, true);
    } catch {
      Alert.alert(t("common.error"), t("library.archiveError"));
      setArchivedCount((n) => Math.max(0, n - 1));
      await loadDecks();
    }
  };

  const confirmDeleteDeck = (deck: Deck) => {
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
  };

  const duplicateDeckFromLibrary = async (deck: Deck) => {
    try {
      await duplicateDeck(deck.id);
      await loadDecks();
    } catch {
      Alert.alert(t("common.error"), t("deckMenu.duplicateError"));
    }
  };

  const shareDeckFromLibrary = async (deck: Deck) => {
    try {
      const { shareUrl } = await shareDeck(deck.id);
      await Share.share({ message: `${deck.title} - ${shareUrl}`, url: shareUrl });
    } catch {
      Alert.alert(t("common.error"), t("deckMenu.shareError"));
    }
  };

  // Volles Deck-Menü in der Bibliothek (#571 Teil C). Vorher gab es hier nur
  // Umbenennen/Archivieren/Löschen — für „Lernen", „Zu Ordner", „Duplizieren"
  // und „Teilen" musste man erst das Deck öffnen, obwohl das Web sie direkt in
  // der Liste anbietet. Ein Aktionsblatt statt eines Alerts: acht Einträge in
  // einem Alert wären auf iOS ein Knopfturm.
  const handleDeckLongPress = (deck: Deck) => setDeckMenu(deck);

  const deckMenuItems: ActionSheetItem[] = deckMenu
    ? [
        {
          key: "learn",
          label: t("deckMenu.learn"),
          icon: Play,
          onPress: () => router.push({ pathname: "/(tabs)/deck/[id]", params: { id: deckMenu.id, title: deckMenu.title } }),
        },
        {
          key: "rename",
          label: t("library.rename"),
          icon: Pencil,
          onPress: () => setPrompt({ kind: "renameDeck", deck: deckMenu }),
        },
        {
          key: "folder",
          label: t("deckMenu.addToFolder"),
          icon: FolderPlus,
          onPress: () => setFolderPickerDeck(deckMenu),
        },
        {
          key: "duplicate",
          label: t("deckMenu.duplicate"),
          icon: Copy,
          onPress: () => void duplicateDeckFromLibrary(deckMenu),
        },
        {
          key: "share",
          label: t("deckMenu.share"),
          icon: Share2,
          onPress: () => void shareDeckFromLibrary(deckMenu),
        },
        // Archivieren (#614) steht VOR dem Löschen und ist nicht rot markiert:
        // es ist der harmlose Weg, ein Deck aus der Bibliothek zu nehmen.
        {
          key: "archive",
          label: t("library.archive"),
          icon: Archive,
          onPress: () => void archiveDeck(deckMenu),
        },
        {
          key: "delete",
          label: t("common.delete"),
          icon: Trash2,
          destructive: true,
          onPress: () => confirmDeleteDeck(deckMenu),
        },
      ]
    : [];

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
            folderDeleteQuestion(
              folder.title,
              descendantFolders(folder.id, folders).map((f) => f.title)
            ),
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
      case "createDeck":
        return {
          icon: Layers,
          title: t("library.newDeck"),
          label: t("library.newDeckPrompt"),
          initialValue: "",
          confirmLabel: t("library.create"),
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
      // Leeres Deck anlegen (#571 Teil C): In der App entstanden Decks bisher
      // nur über den Scan — wer einfach ein paar Karten von Hand tippen wollte,
      // musste erst etwas scannen. Das Web hat den Knopf seit jeher.
      case "createDeck": {
        if (!value.trim() || !userId) return;
        try {
          const { deck } = await createDeck(userId, value.trim());
          await loadDecks();
          router.push({ pathname: "/(tabs)/deck/[id]", params: { id: deck.id, title: deck.title } });
        } catch (error) {
          // Die Deck-Grenze meldet der Server (#611) — seinen Klartext zeigen,
          // statt ihn durch ein allgemeines „hat nicht geklappt" zu ersetzen.
          const message = error instanceof Error ? error.message : t("library.createDeckError");
          Alert.alert(t("common.error"), message);
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

  const renderEmpty = (icon: React.ReactNode, message: string, action?: React.ReactNode) => (
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
      {action}
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
                `/deck/${hit.deckId}?title=${encodeURIComponent(hit.deckTitle)}&card=${hit.cardId}`
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
          decks.length === 0 ? t("library.emptyDecks") : t("library.noMatchDecks"),
          // Der Text rät zum Scannen — der Knopf führt auch hin (#609). Nur im
          // wirklich leeren Zustand, nicht bei einer erfolglosen Suche.
          decks.length === 0 ? (
            // Zwei Wege wie im Web (#571 Teil C): Scannen bleibt der empfohlene,
            // aber wer seine Karten selbst tippen will, kam in der App bisher
            // gar nicht los — Decks entstanden ausschliesslich beim Scannen.
            <View style={{ gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/scan")}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.xxl,
                  paddingVertical: 14,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: typography.semibold, fontSize: typography.base }}>
                  {t("library.scanCta")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPrompt({ kind: "createDeck" })}
                activeOpacity={0.8}
                style={{
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: typography.semibold, fontSize: typography.base }}>
                  {t("library.newDeckCta")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        );
      }
      return (
        <>
          {cardSection}
          {/* Deck-Reihenfolge umschalten (#614) — erst ab zwei Decks, und im
              gleichen Aussehen wie die Ordner-Umschaltung aus #612. */}
          {filteredDecks.length > 1 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: spacing.xs,
                marginBottom: spacing.sm,
              }}
              accessibilityRole="radiogroup"
            >
              <ArrowUpDown size={15} color={colors.textTertiary} />
              {(
                [
                  ["created", t("library.sortDeckCreated")],
                  ["alpha", t("library.sortDeckAlpha")],
                  ["due", t("library.sortDeckDue")],
                  ["learned", t("library.sortDeckLearned")],
                ] as const
              ).map(([value, label]) => {
                const active = deckSort === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => {
                      setDeckSort(value);
                      void saveDeckSort(value);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.full ?? 999,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primaryLight : colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: typography.sm,
                        fontWeight: typography.semibold,
                        color: active ? colors.primary : colors.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {filteredDecks.map(renderDeckItem)}
          {/* Einstieg ins Archiv (#614) — nur, wenn dort etwas liegt. Wie im
              Web unter der Liste, nicht im Profil. */}
          {archivedCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push("/archive")}
              activeOpacity={0.7}
              style={{
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: spacing.md,
              }}
            >
              <ArchiveIcon size={16} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: typography.bold,
                  fontSize: typography.sm,
                }}
              >
                {t("library.archiveEntry", { count: archivedCount })}
              </Text>
            </TouchableOpacity>
          )}
        </>
      );
    }

    if (filteredFolders.length === 0) {
      return renderEmpty(
        <FolderOpen size={28} color={colors.textTertiary} />,
        folders.length === 0 ? t("library.emptyFolders") : t("library.noMatchFolders")
      );
    }
    return (
      <>
        {/* Reihenfolge umschalten (#612) — erst ab zwei Ordnern, darunter gibt
            es nichts zu sortieren. */}
        {folders.length > 1 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              marginBottom: spacing.sm,
            }}
            accessibilityRole="radiogroup"
          >
            <ArrowUpDown size={15} color={colors.textTertiary} />
            {(
              [
                ["alpha", t("library.sortAlpha")],
                ["recent", t("library.sortRecent")],
              ] as const
            ).map(([value, label]) => {
              const active = folderSort === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    setFolderSort(value);
                    void saveFolderSort(value);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full ?? 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primaryLight : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: typography.semibold,
                      color: active ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {filteredFolders.map(renderFolderItem)}
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontSize: typography.xxl, fontWeight: typography.bold, color: colors.text }}>
              {t("library.title")}
            </Text>
            {/* Füllstand (#611): Die Deck-Grenze war unsichtbar, bis sie riss —
                der Endpunkt liefert sie seit #411 mit, nur fragte sie hier
                niemand ab. Bei unbekannter Grenze steht nichts (#603). */}
            {deckSlotsLabel !== null && activeTab === "decks" && (
              <Text
                style={{
                  fontSize: typography.sm,
                  color: decksAtLimit ? colors.warning : colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {deckSlotsLabel}
              </Text>
            )}
          </View>
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
          // Alle Fenster hier sind Namen (Deck/Ordner) — Servergrenze 120 (#612).
          maxLength={TITLE_MAX_LENGTH}
          onCancel={() => setPrompt(null)}
          onSubmit={handlePromptSubmit}
        />
      ) : null}

      {/* Volles Deck-Menü der Bibliothek (#571 Teil C) */}
      <ActionSheet
        visible={deckMenu !== null}
        title={deckMenu?.title ?? ""}
        items={deckMenuItems}
        onClose={() => setDeckMenu(null)}
      />

      {folderPickerDeck ? (
        <FolderPickerModal
          visible
          deckId={folderPickerDeck.id}
          onClose={() => setFolderPickerDeck(null)}
          onAdded={() => {
            setFolderPickerDeck(null);
            loadFolders();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
