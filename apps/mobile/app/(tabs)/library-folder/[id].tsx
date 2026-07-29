import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
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
  GripVertical,
  MoreVertical,
  Folder as FolderIcon,
  Play,
  Plus,
} from "lucide-react-native";
import DeckPickerModal from "../../../src/components/DeckPickerModal";
import TextPromptModal from "../../../src/components/TextPromptModal";
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from "../../../src/lib/titleLimit";
import { useTranslation } from "react-i18next";
import {
  getFolder,
  listDecksInFolder,
  listFolders,
  updateFolderApi,
  deleteFolderApi,
  removeDeckFromFolder,
  setFolderDeckOrder,
  getDueCards,
  type Deck,
  type Folder,
} from "../../../src/lib/api";
import { excludeOcclusionCards } from "../../../src/lib/occlusion";
import { useColors, spacing, radius, typography, shadows } from "../../../src/theme";
import { createDetailStackOptions } from "../../../src/navigation/detailStackOptions";
import { filterDueCardsByDeckIds } from "../../../src/lib/learnFilters";
import { buildLibraryFolderRoute } from "../../../src/navigation/libraryRoutes";
import { useReviewSession } from "../../../src/features/review/reviewSession";
import { useSessionStore } from "../../../src/store/sessionStore";

export default function FolderDetailScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();

  const userId = useSessionStore((s) => s.userId);
  // startPreset statt start: markiert die Auswahl als „von hier vorgegeben", damit
  // der Lern-Tab sie nicht mit den global fälligen Karten überschreibt (#282).
  const startPreset = useReviewSession((s) => s.startPreset);

  const [currentTitle, setCurrentTitle] = useState(title ?? "");
  const [description, setDescription] = useState<string | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingLearn, setStartingLearn] = useState(false);
  const [deckPickerVisible, setDeckPickerVisible] = useState(false);
  // Eigenes Eingabe-Fenster statt Eingabe-Alert: den gibt es nur auf iOS (#396).
  const [renamePromptVisible, setRenamePromptVisible] = useState(false);
  const [descriptionPromptVisible, setDescriptionPromptVisible] = useState(false);

  const folderId = id ?? "";

  const loadContent = useCallback(async () => {
    if (!folderId) return;
    try {
      // getFolder läuft jetzt IMMER mit (früher nur ohne Titel-Parameter):
      // die Beschreibung steht nirgendwo sonst.
      const [decksRes, foldersRes, folderData] = await Promise.all([
        listDecksInFolder(folderId),
        listFolders(),
        getFolder(folderId).catch(() => null),
      ]);
      setDecks(decksRes.decks);
      // Filter subfolders (children of this folder)
      setSubfolders(foldersRes.folders.filter((f) => f.parentId === folderId));
      if (folderData?.folder) {
        if (folderData.folder.title) setCurrentTitle(folderData.folder.title);
        setDescription(folderData.folder.description ?? null);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [folderId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const onRefresh = () => {
    setRefreshing(true);
    loadContent();
  };

  const handleRenameFolder = useCallback(() => setRenamePromptVisible(true), []);

  // Das Fenster schliesst beim Bestätigen — wie zuvor der Alert — und die
  // eigentliche Arbeit läuft danach. Leerer Name wird wie bisher verworfen.
  const handleRenameSubmit = useCallback(
    async (value: string) => {
      setRenamePromptVisible(false);
      if (!value.trim()) return;
      try {
        await updateFolderApi(folderId, { title: value.trim() });
        setCurrentTitle(value.trim());
      } catch {
        Alert.alert(t("common.error"), t("folderDetail.renameError"));
      }
    },
    [folderId, t]
  );

  // Leer speichern löscht die Beschreibung — der Server macht aus "" ein null.
  const handleDescriptionSubmit = useCallback(
    async (value: string) => {
      setDescriptionPromptVisible(false);
      try {
        const { folder } = await updateFolderApi(folderId, { description: value.trim() });
        setDescription(folder.description ?? null);
      } catch {
        Alert.alert(t("common.error"), t("folderDetail.descriptionError"));
      }
    },
    [folderId, t]
  );

  // ─── Reihenfolge per Ziehgriff (#437) ─────────────────────────────────────
  // Gleiches Verhalten wie im Web: Die Liste sortiert schon WÄHREND des
  // Ziehens sichtbar um, gespeichert wird beim Loslassen. Die Reihenfolge
  // sortiert nur — sie sperrt nie ein Deck.

  // Für den Loslassen-Handler: der ist eine alte Closure und sähe sonst den
  // Deck-Stand vom Beginn des Zugs.
  const decksRef = useRef<Deck[]>([]);
  useEffect(() => {
    decksRef.current = decks;
  }, [decks]);

  // Welcher Karten-Index gerade gezogen wird; steuert Stil + Scroll-Sperre.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Sichtbare Verschiebung der gezogenen Zeile — ein Animated.Value, damit
  // jede Fingerbewegung NICHT die ganze Liste neu zeichnet.
  const dragY = useRef(new Animated.Value(0)).current;
  // baseline = wie viele Slot-Höhen die Zeile durch Tausche schon "gewandert"
  // ist; die sichtbare Verschiebung ist immer dy minus baseline.
  const dragState = useRef<{ index: number; baseline: number } | null>(null);
  // Zeilenhöhe wird gemessen statt geraten (Schriftgrössen-Einstellungen!).
  const rowHeightRef = useRef(0);
  // Muss zum `gap` des ScrollView-Inhalts passen (spacing.sm + 2).
  const ROW_GAP = spacing.sm + 2;

  const persistOrder = useCallback(async () => {
    try {
      await setFolderDeckOrder(
        folderId,
        decksRef.current.map((d) => d.id)
      );
    } catch {
      // Erst neu laden, dann melden — sonst bliebe das Zurückspringen der
      // Karten unerklärt (gleiche Lehre wie im Web, PR #451).
      await loadContent();
      Alert.alert(t("common.error"), t("folderDetail.reorderError"));
    }
  }, [folderId, loadContent, t]);

  // Der Fänger unten lebt über die ganze Lebenszeit des Bildschirms — er darf
  // deshalb nur über diesen Ref speichern, nie über die (wandernde) Closure.
  const persistOrderRef = useRef(persistOrder);
  useEffect(() => {
    persistOrderRef.current = persistOrder;
  }, [persistOrder]);

  // Welche Zeile der Finger gerade angefasst hat. Wird vom Griff per
  // onTouchStart gesetzt — das feuert VOR der Responder-Vergabe.
  const pendingIndexRef = useRef(0);

  // Genau EIN PanResponder für alle Griffe. Würde je Zeile und Renderdurchlauf
  // ein neuer erzeugt, ersetzte jeder Platztausch mitten im Zug die Handler
  // durch eine Instanz, die den Zug nie begonnen hat — die Geste risse ab.
  const gripResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragState.current = { index: pendingIndexRef.current, baseline: 0 };
        dragY.setValue(0);
        setDragIndex(pendingIndexRef.current);
      },
      onPanResponderMove: (_evt, gesture) => {
        const s = dragState.current;
        if (!s) return;
        const slot = rowHeightRef.current + ROW_GAP;
        if (slot <= ROW_GAP) return;
        const rel = gesture.dy - s.baseline;
        // Mehr als eine halbe Zeile bewegt? Dann Platz tauschen und die
        // Grundlinie mitziehen, damit die Zeile unterm Finger bleibt.
        if (rel > slot / 2 && s.index < decksRef.current.length - 1) {
          const from = s.index;
          setDecks((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            if (!moved) return prev;
            next.splice(from + 1, 0, moved);
            return next;
          });
          s.index += 1;
          s.baseline += slot;
          setDragIndex(s.index);
        } else if (rel < -slot / 2 && s.index > 0) {
          const from = s.index;
          setDecks((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            if (!moved) return prev;
            next.splice(from - 1, 0, moved);
            return next;
          });
          s.index -= 1;
          s.baseline -= slot;
          setDragIndex(s.index);
        }
        dragY.setValue(gesture.dy - s.baseline);
      },
      onPanResponderRelease: () => {
        dragState.current = null;
        dragY.setValue(0);
        setDragIndex(null);
        void persistOrderRef.current();
      },
      onPanResponderTerminate: () => {
        dragState.current = null;
        dragY.setValue(0);
        setDragIndex(null);
        void persistOrderRef.current();
      },
    })
  ).current;

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

  const handleLearnAll = useCallback(async () => {
    if (!userId || decks.length === 0) return;
    setStartingLearn(true);
    try {
      const { cards } = await getDueCards(userId);
      // Occlusion cards can't be studied as flashcards (see excludeOcclusionCards).
      // They must be dropped HERE too: this screen pre-fills the review store and
      // pushes to /learn, which then keeps the given cards instead of re-loading —
      // so the learn screen's own filter would never run.
      const filtered = filterDueCardsByDeckIds(
        excludeOcclusionCards(cards),
        decks.map((d) => d.id)
      );
      if (filtered.length === 0) {
        Alert.alert(t("learn.noDueCards"), t("learn.noDueCardsMessage"));
        return;
      }
      startPreset(filtered.map((c) => ({ id: c.id, front: c.front, back: c.back, starred: c.starred })));
      router.push("/(tabs)/learn");
    } catch {
      Alert.alert(t("common.error"), t("learn.loadError"));
    } finally {
      setStartingLearn(false);
    }
  }, [userId, decks, t, startPreset, router]);

  const handleMoreMenu = useCallback(() => {
    Alert.alert(currentTitle, "", [
      // First entry on purpose: this is the menu people reach for while standing
      // in the folder — it previously offered no way to fill it.
      { text: t("folderDetail.addDeck"), onPress: () => setDeckPickerVisible(true) },
      { text: t("folderDetail.rename"), onPress: handleRenameFolder },
      { text: t("folderDetail.editDescription"), onPress: () => setDescriptionPromptVisible(true) },
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
            {description ? (
              <Text
                style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  marginTop: spacing.md,
                  lineHeight: 20,
                }}
              >
                {description}
              </Text>
            ) : null}
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
                {t("folderDetail.learnAll")}
              </Text>
            </TouchableOpacity>
          )}

          {/* Content */}
          {loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={{ gap: ROW_GAP, paddingBottom: spacing.xxl }}
              // Beim Ziehen gehört die Fingerbewegung dem Griff, nicht dem
              // Scrollen — sonst raten Geste und Liste gegeneinander.
              scrollEnabled={dragIndex === null}
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
                  {/* The empty folder used to only point elsewhere ("add decks via
                      the three-dot menu in the deck") — a dead end: you stood in
                      the folder and had to leave to fill it. */}
                  <TouchableOpacity
                    onPress={() => setDeckPickerVisible(true)}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      backgroundColor: colors.primary,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <Plus size={18} color={colors.textInverse} />
                    <Text style={{ color: colors.textInverse, fontWeight: typography.semibold, fontSize: typography.base }}>
                      {t("folderDetail.addDeck")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                {decks.map((deck, index) => (
                  <Animated.View
                    key={deck.id}
                    onLayout={
                      index === 0
                        ? (e) => {
                            rowHeightRef.current = e.nativeEvent.layout.height;
                          }
                        : undefined
                    }
                    style={
                      dragIndex === index
                        ? {
                            transform: [{ translateY: dragY }, { scale: 1.02 }],
                            zIndex: 2,
                            opacity: 0.9,
                          }
                        : null
                    }
                  >
                    <TouchableOpacity
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
                        borderColor: dragIndex === index ? colors.primary : colors.border,
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
                        {/* Griff nur zeigen, wenn Sortieren etwas bewirken kann. */}
                        {decks.length > 1 && (
                          <View
                            accessible
                            accessibilityLabel={t("folderDetail.moveDeck", { title: deck.title })}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ paddingHorizontal: spacing.sm, paddingVertical: 4 }}
                            // onTouchStart feuert vor der Responder-Vergabe und
                            // sagt dem geteilten Fänger, WELCHE Zeile es ist.
                            onTouchStart={() => {
                              pendingIndexRef.current = index;
                            }}
                            {...gripResponder.panHandlers}
                          >
                            <GripVertical size={18} color={colors.textTertiary} />
                          </View>
                        )}
                        <ChevronRight size={18} color={colors.textTertiary} />
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
                {/* Dauerhaft unter der Liste — vorher gab es den Knopf nur im
                    LEEREN Ordner, danach musste man ihn im Drei-Punkte-Menü
                    suchen (Laras Fund, 22.07.). Gestrichelt, damit er nicht
                    wie eine Deck-Zeile aussieht. */}
                <TouchableOpacity
                  onPress={() => setDeckPickerVisible(true)}
                  activeOpacity={0.7}
                  style={{
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: colors.primary,
                    borderRadius: radius.md,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: typography.semibold,
                      fontSize: typography.base,
                    }}
                  >
                    + {t("folderDetail.addDeck")}
                  </Text>
                </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
      </View>

      {userId ? (
        <DeckPickerModal
          visible={deckPickerVisible}
          folderId={folderId}
          userId={userId}
          onClose={() => setDeckPickerVisible(false)}
          onAdded={() => {
            // Reload so the decks show up right away — the picker only writes
            // the links, this screen holds its own list. Kein Erfolgs-Alert:
            // dass die Decks da sind, zeigt die Liste selbst.
            loadContent();
          }}
        />
      ) : null}

      {/* Nur bei offenem Fenster eingehängt: so springt der Tastatur-Fokus
          (autoFocus) bei JEDEM Öffnen wieder ins Feld. */}
      {renamePromptVisible ? (
        <TextPromptModal
          visible
          icon={FolderOpen}
          title={t("folderDetail.rename")}
          label={t("folderDetail.renamePrompt")}
          initialValue={currentTitle}
          confirmLabel={t("common.save")}
          // Servergrenze für Ordnernamen (#612).
          maxLength={TITLE_MAX_LENGTH}
          onCancel={() => setRenamePromptVisible(false)}
          onSubmit={handleRenameSubmit}
        />
      ) : null}

      {descriptionPromptVisible ? (
        <TextPromptModal
          visible
          icon={FolderOpen}
          title={t("folderDetail.editDescription")}
          label={t("folderDetail.descriptionPrompt")}
          placeholder={t("folderDetail.descriptionPlaceholder")}
          initialValue={description ?? ""}
          confirmLabel={t("common.save")}
          // Freitext: mehrzeilig, und leer speichern löscht die Beschreibung.
          multiline
          allowEmpty
          // Servergrenze der Beschreibung (#612) — vorher kam der Fehler erst
          // beim Speichern.
          maxLength={DESCRIPTION_MAX_LENGTH}
          onCancel={() => setDescriptionPromptVisible(false)}
          onSubmit={handleDescriptionSubmit}
        />
      ) : null}
    </SafeAreaView>
  );
}
