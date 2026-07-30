import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Plus,
  CreditCard,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Star,
  Brain,
  Puzzle,
  ImagePlus,
  Pencil,
  FileText,
  Layers,
  MoreVertical,
  Download,
} from "lucide-react-native";
import {
  listCardsInDeck,
  createCard,
  updateCard,
  deleteCard,
  deleteDeck,
  duplicateDeck,
  shareDeck,
  revokeDeckShare,
  exportDeckForOffline,
  getDeckDetails,
  getLpBalance,
  type Card,
} from "../../../src/lib/api";
import { summarizeCardMedia } from "../../../src/lib/cardMedia";
import { cardDeleteQuestion, cardKindLabel } from "../../../src/lib/cardDisplay";
import { adviceForLimit } from "../../../src/lib/importLimits";
import { usageFromBalanceResponse, useUsageStore } from "../../../src/store/usageStore";
import {
  cardsFromOfflineDeckCache,
  offlineDeckStorageKey,
} from "../../../src/lib/offlineDeckCache";
import { setLastUsedDeck } from "../../../src/lib/lastUsedDeck";
import { useSessionStore } from "../../../src/store/sessionStore";
import { useColors, spacing, radius, typography, shadows } from "../../../src/theme";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeckActionSheet from "../../../src/components/DeckActionSheet";
import FolderPickerModal from "../../../src/components/FolderPickerModal";
import { isOcclusionCard } from "../../../src/lib/occlusion";
import { buildDeckCountLabel } from "../../../src/lib/deckCountLabel";
import { difficultyLabel } from "../../../src/lib/cardLabels";
import DeckEditModal from "../../../src/components/DeckEditModal";
import DeckDetailsModal from "../../../src/components/DeckDetailsModal";

// Card editor modal component. Bewusst OHNE Kartentyp-Schalter: die Achse
// basic↔cloze leitet der Server aus dem Text ab ({{cN::…}}-Markierung oder
// ______-Lücke) — ein von Hand gesetztes Etikett konnte nur lügen, denn eine
// Lücke gibt es nur, wenn sie im Text steht.
function CardEditor({
  visible,
  card,
  saving,
  onSave,
  onCancel,
}: {
  visible: boolean;
  card: {
    front: string;
    back: string;
    difficulty: string;
  } | null;
  saving: boolean;
  onSave: (data: {
    front: string;
    back: string;
    difficulty: string;
  }) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setDifficulty(card.difficulty);
    } else {
      setFront("");
      setBack("");
      setDifficulty("medium");
    }
  }, [card, visible]);

  const isValid = front.trim().length > 0 && back.trim().length > 0;

  // Nachfrage vor dem Verwerfen (#608, wortgleich zum Web): „Abbrechen" und
  // die Android-Zurück-Taste werfen sonst halbfertigen Text kommentarlos weg.
  const dirty =
    front !== (card?.front ?? "") ||
    back !== (card?.back ?? "") ||
    difficulty !== (card?.difficulty ?? "medium");

  const requestClose = () => {
    // Während des Speicherns nicht schließen — sonst wüsste niemand, ob die
    // Karte angekommen ist.
    if (saving) return;
    if (!dirty) {
      onCancel();
      return;
    }
    Alert.alert("Änderungen verwerfen?", "Dein eingetippter Text geht sonst verloren.", [
      // „Weiter bearbeiten" ist der cancel-Knopf (betont): Wer aus Versehen
      // rausgeht, kommt am leichtesten zurück zum Text.
      { text: "Weiter bearbeiten", style: "cancel" },
      { text: "Verwerfen", style: "destructive", onPress: onCancel },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android-Zurück-Taste (#608) — vorher tat sie hier nichts.
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TouchableOpacity
              onPress={requestClose}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <X size={18} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.base,
                }}
              >
                Abbrechen
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                fontWeight: typography.bold,
                fontSize: typography.lg,
                color: colors.text,
              }}
            >
              {card ? "Karte bearbeiten" : "Neue Karte"}
            </Text>
            <TouchableOpacity
              onPress={() =>
                onSave({
                  front: front.trim(),
                  back: back.trim(),
                  difficulty,
                })
              }
              // `saving` sperrt gegen Doppeltippen (#608): Jeder weitere Tipp
              // legte sonst dieselbe Karte noch einmal an.
              disabled={!isValid || saving}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Check
                size={18}
                color={isValid && !saving ? colors.primary : colors.textTertiary}
              />
              <Text
                style={{
                  color: isValid && !saving ? colors.primary : colors.textTertiary,
                  fontSize: typography.base,
                  fontWeight: typography.bold,
                }}
              >
                {/* Wie im Web (#571): eine NEUE Karte wird „hinzugefügt", eine
                    bestehende „gespeichert". Vorher hieß beides „Speichern". */}
                {saving ? "Speichert …" : card ? "Speichern" : "Hinzufügen"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          >
            {/* Front */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Vorderseite (Frage)
              </Text>
              <TextInput
                value={front}
                onChangeText={setFront}
                // Ohne Platzhalter wie im Web (#571): Die Beschriftung steht
                // schon über dem Feld und bleibt beim Tippen stehen — der
                // Platzhalter verschwand genau dann, wenn man ihn braucht.
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  color: colors.text,
                }}
              />
            </View>

            {/* Back */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Rückseite (Antwort)
              </Text>
              <TextInput
                value={back}
                onChangeText={setBack}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  color: colors.text,
                }}
              />
            </View>

            {/* Difficulty selector */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Schwierigkeit
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["easy", "medium", "hard"] as const).map((d) => {
                  // Wortlaut aus dem geteilten Helfer (#609), damit Deck-Ansicht
                  // und Scan-Vorschau nie auseinanderlaufen; Farben bleiben hier.
                  const tone = {
                    easy: { color: colors.success, bg: colors.successLight },
                    medium: { color: colors.warning, bg: colors.warningLight },
                    hard: { color: colors.error, bg: colors.errorLight },
                  };
                  const label = difficultyLabel(d);
                  const { color, bg } = tone[d];
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDifficulty(d)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: radius.md,
                        borderWidth: 2,
                        borderColor:
                          difficulty === d ? color : colors.border,
                        backgroundColor:
                          difficulty === d ? bg : colors.surface,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: typography.semibold,
                          color:
                            difficulty === d
                              ? color
                              : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function DeckDetailScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const userId = useSessionStore((state) => state.userId);
  const colors = useColors();
  const { t } = useTranslation();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  // Ein gescheiterter Ladevorgang (offline / Serverfehler) darf nicht wie ein
  // leeres Deck aussehen — sonst denkt man, die eigenen Karten sind weg (#284).
  const [loadError, setLoadError] = useState(false);

  // "20 Karten · 10 Bilder". The library counts the same way (server side), so
  // both agree — before this, the library said 20 (text only) while this header
  // said 30 (everything): same deck, two numbers. The card LIST below still
  // shows every card, image ones included, so they stay manageable.
  const imageCardCount = cards.filter(isOcclusionCard).length;
  const textCardCount = cards.length - imageCardCount;
  // Füllstand statt reiner Anzahl (#611): „142 von 150 Karten" sagt VOR dem
  // Tippen, wie viel Platz bleibt. `maxCardsPerDeck` ist `null`, solange der
  // Server die Grenzen nicht geliefert hat (#603) — dann bleibt das alte Label
  // und nichts wird gesperrt.
  const maxCardsPerDeck = useUsageStore((state) => state.maxCardsPerDeck);
  const setUsage = useUsageStore((state) => state.setUsage);
  const deckCountLabel = buildDeckCountLabel(textCardCount, imageCardCount, maxCardsPerDeck);
  const deckIsFull =
    typeof maxCardsPerDeck === "number" && textCardCount + imageCardCount >= maxCardsPerDeck;
  const [refreshing, setRefreshing] = useState(false);

  // Grenzen einmalig nachladen, falls dieser Bildschirm der erste ist (Deeplink,
  // App-Neustart auf einem Deck). Kommt der Nutzer über die Startseite, hat das
  // LP-Abzeichen sie längst geholt — dann kostet das hier keinen Aufruf.
  useEffect(() => {
    if (maxCardsPerDeck !== null) return;
    void getLpBalance()
      .then((res) => setUsage(usageFromBalanceResponse(res)))
      .catch(() => {
        // Ohne Grenzen bleibt das alte Label stehen und nichts wird gesperrt.
      });
  }, [maxCardsPerDeck, setUsage]);

  // Card editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [saving, setSaving] = useState(false);

  // Three-dot menu and modal states
  const [menuVisible, setMenuVisible] = useState(false);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [editDeckVisible, setEditDeckVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [currentDeckTitle, setCurrentDeckTitle] = useState(title ?? "Deck");
  const [currentDeckTags, setCurrentDeckTags] = useState<string[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const deckId = id ?? "";
  const deckTitle = currentDeckTitle;

  // Remember this as the last-used deck for the Home row — opening the deck
  // is the mode-independent "benutzt" signal (practice modes leave no
  // review_logs, so the server can't see them).
  useEffect(() => {
    if (deckId) {
      void setLastUsedDeck({ id: deckId, title: deckTitle });
    }
  }, [deckId, deckTitle]);

  // Header via the Tabs navigator (this screen lives inside the tab group so
  // the bottom bar stays visible). Solid bar + hairline per #192; the back
  // chevron is explicit because tab headers render no automatic back button.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: deckTitle,
      headerTintColor: colors.primary,
      headerStyle: { backgroundColor: colors.surface },
      headerShadowVisible: true,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/decks");
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingHorizontal: spacing.md }}
        >
          <ChevronLeft size={26} color={colors.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
          }}
        >
          {isOffline && <Download size={16} color={colors.success} />}
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
          >
            <MoreVertical
              size={22}
              color={colors.text}
              style={{ transform: [{ translateX: 1 }, { translateY: 0.5 }] }}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, router, deckTitle, colors, isOffline]);

  const loadCards = useCallback(async () => {
    if (!deckId) return;
    setLoadError(false);
    // Deck-Kopfdaten mitladen (#612): Titel und Etiketten kamen bisher NUR aus
    // dem Routen-Parameter, mit dem diese Seite geöffnet wurde. Eine Umbenennung
    // auf einem anderen Gerät tauchte hier nie auf — auch nach Herunterziehen
    // nicht. Best-effort: scheitert der Abruf (offline), bleibt der bisherige
    // Titel stehen, die Kartenliste unten hat ihren eigenen Offline-Weg.
    void getDeckDetails(deckId)
      .then(({ details }) => {
        if (details.title) setCurrentDeckTitle(details.title);
        setCurrentDeckTags(details.tags ?? []);
      })
      .catch(() => { /* Titel aus dem Routen-Parameter behalten */ });
    try {
      const { cards: fetched } = await listCardsInDeck(deckId);
      setCards(fetched);
    } catch {
      const cached = await AsyncStorage.getItem(offlineDeckStorageKey(deckId));
      const cachedCards = cardsFromOfflineDeckCache(cached);
      if (cachedCards) {
        // Der Offline-Cache hat die Ansicht gerettet — das ist ein Erfolg,
        // kein Fehler. Kein Hinweis, kein Retry.
        setCards(cachedCards);
      } else {
        // Distinguish a load failure (offline / server error) from a genuinely
        // empty deck so we can offer a retry instead of "noch keine Karten".
        setLoadError(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deckId]);

  useEffect(() => {
    loadCards();
    // Check offline status
    AsyncStorage.getItem(offlineDeckStorageKey(deckId)).then((data) => {
      setIsOffline(!!data);
    });
  }, [loadCards, deckId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCards();
  };

  // Nach einem Ladefehler erneut versuchen — mit Spinner statt stiller Wartezeit.
  const retryLoad = () => {
    setLoading(true);
    loadCards();
  };

  // --- Deck menu actions ---

  const handleDownloadOffline = async () => {
    if (isOffline) {
      Alert.alert(t("common.success"), t("deckAction.alreadyOffline"));
      return;
    }
    try {
      const data = await exportDeckForOffline(deckId);
      await AsyncStorage.setItem(offlineDeckStorageKey(deckId), JSON.stringify(data));
      setIsOffline(true);
      Alert.alert(t("common.success"), t("deckAction.downloadSuccess"));
    } catch {
      Alert.alert(t("common.error"), t("deckAction.downloadError"));
    }
  };

  const handleEditDeck = () => {
    setEditDeckVisible(true);
  };

  const handleDeckSaved = (newTitle: string, newTags: string[]) => {
    setCurrentDeckTitle(newTitle);
    setCurrentDeckTags(newTags);
  };

  const handleAddToFolder = () => {
    setFolderPickerVisible(true);
  };

  const handleDuplicate = async () => {
    try {
      const { deck } = await duplicateDeck(deckId);
      Alert.alert(t("common.success"), t("deckAction.duplicateSuccess"));
      // Navigate to the new duplicated deck
      router.push({
        pathname: "/deck/[id]",
        params: { id: deck.id, title: deck.title },
      });
    } catch (e) {
      // An einer Tarifgrenze erklärt der Server, woran es liegt und ob ein
      // Upgrade hilft (#611). „Duplizieren fehlgeschlagen" verschwieg beides.
      const advice = adviceForLimit(e);
      if (advice) {
        Alert.alert(t("deckAction.duplicateBlockedTitle"), advice);
      } else {
        Alert.alert(t("common.error"), t("deckAction.duplicateError"));
      }
    }
  };

  const handleShare = async () => {
    try {
      const { shareUrl } = await shareDeck(deckId);
      await Share.share({
        message: `${deckTitle} - ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      Alert.alert(t("common.error"), t("deckAction.shareError"));
    }
  };

  const handleRevokeShare = () => {
    Alert.alert(
      t("deckAction.revokeShareTitle"),
      t("deckAction.revokeShareMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("deckAction.revokeShareConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              const { revoked } = await revokeDeckShare(deckId);
              if (revoked) {
                Alert.alert(t("common.success"), t("deckAction.revokeShareSuccess"));
              } else {
                Alert.alert(t("deckMenu.revokeShare"), t("deckAction.revokeShareNone"));
              }
            } catch {
              Alert.alert(t("common.error"), t("deckAction.revokeShareError"));
            }
          },
        },
      ]
    );
  };

  const handleDetails = () => {
    setDetailsVisible(true);
  };

  const handleDeleteDeck = () => {
    Alert.alert(
      t("deckAction.deleteTitle"),
      t("deckAction.deleteMessage", { title: deckTitle }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDeck(deckId);
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/decks");
              }
            } catch {
              Alert.alert(t("common.error"), t("deckAction.deleteError"));
            }
          },
        },
      ]
    );
  };

  // --- Card actions ---

  const handleAddCard = () => {
    setEditingCard(null);
    setEditorVisible(true);
  };

  const handleEditCard = (card: Card) => {
    setEditingCard(card);
    setEditorVisible(true);
  };

  const handleDeleteCard = (card: Card) => {
    Alert.alert(
      // Wortlaut und Satzform wie im Web (#571) — der zitierte Kartenanfang
      // kommt aus dem gemeinsamen Helfer, damit beide Seiten gleich kürzen.
      card.type === "occlusion" ? "Bild-Karte löschen" : "Karte löschen",
      cardDeleteQuestion(card),
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCard(card.id);
              setCards((prev) => prev.filter((c) => c.id !== card.id));
            } catch {
              Alert.alert("Fehler", "Karte konnte nicht gelöscht werden.");
            }
          },
        },
      ]
    );
  };

  const handleToggleStar = async (card: Card) => {
    const newVal = !card.starred;
    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, starred: newVal } : c))
    );
    try {
      await updateCard(card.id, { starred: newVal });
    } catch {
      // Revert on error
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, starred: !newVal } : c))
      );
    }
  };

  const handleCardLongPress = (card: Card) => {
    Alert.alert("Karte", "Was möchtest du tun?", [
      { text: "Bearbeiten", onPress: () => handleEditCard(card) },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => handleDeleteCard(card),
      },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const handleSaveCard = async (data: {
    front: string;
    back: string;
    difficulty: string;
  }) => {
    if (!userId || !deckId) return;
    setSaving(true);
    try {
      if (editingCard) {
        const { card: updated } = await updateCard(editingCard.id, data);
        setCards((prev) =>
          prev.map((c) => (c.id === editingCard.id ? updated : c))
        );
      } else {
        const { card: created } = await createCard(userId, deckId, {
          ...data,
          tags: [],
        });
        setCards((prev) => [...prev, created]);
      }
      setEditorVisible(false);
      setEditingCard(null);
    } catch (e) {
      // Am vollen Deck nennt der Server die erlaubte Kartenzahl und den
      // Ausweg (#611) — vorher stand hier nur „konnte nicht gespeichert".
      const advice = adviceForLimit(e);
      if (advice) {
        Alert.alert(t("deckAction.cardSaveBlockedTitle"), advice);
      } else {
        Alert.alert(t("common.error"), t("deckAction.cardSaveError"));
      }
    } finally {
      setSaving(false);
    }
  };

  // Difficulty badge colors — Wortlaut kommt aus dem geteilten Helfer (#609).
  const difficultyMeta: Record<
    string,
    { color: string; label: string }
  > = {
    easy: { color: colors.success, label: difficultyLabel("easy") },
    medium: { color: colors.warning, label: difficultyLabel("medium") },
    hard: { color: colors.error, label: difficultyLabel("hard") },
  };

  // Shared styling for the "pick a study mode" rows shown above the card list.
  const studyModeRowStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;
  const studyModeIconStyle = {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  } as const;
  const studyModeTitleStyle = {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  } as const;
  const studyModeDescStyle = {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 1,
  } as const;

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
        {/* One page-level ScrollView: deck info, study modes and the card list
            scroll together as a single page, Quizlet-style (#192). */}
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          contentContainerStyle={{
            flexGrow: 1,
            padding: spacing.lg,
            gap: spacing.md,
            paddingBottom: spacing.xxl,
          }}
        >

          {/* Header with card count + add button */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: typography.base,
                // Am vollen Deck warnfarben — die Zahl IST hier die Nachricht.
                color: deckIsFull && !loading ? colors.warning : colors.textSecondary,
                fontWeight: typography.medium,
                flexShrink: 1,
              }}
            >
              {loading ? "Lade..." : deckIsFull ? `${deckCountLabel} — voll` : deckCountLabel}
            </Text>
            <TouchableOpacity
              onPress={handleAddCard}
              activeOpacity={0.8}
              // Nichts anbieten, was der Server sicher ablehnt (#611): Am vollen
              // Deck führte „+ Karte" bisher durch den ganzen Editor bis in eine
              // Fehlermeldung. Die Zahl links sagt, warum der Knopf schläft.
              disabled={deckIsFull}
              accessibilityState={{ disabled: deckIsFull }}
              style={{
                backgroundColor: deckIsFull ? colors.border : colors.primary,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                paddingVertical: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Plus
                size={16}
                color={deckIsFull ? colors.textSecondary : colors.textInverse}
                strokeWidth={3}
              />
              <Text
                style={{
                  color: deckIsFull ? colors.textSecondary : colors.textInverse,
                  fontWeight: typography.bold,
                  fontSize: typography.base,
                }}
              >
                Karte
              </Text>
            </TouchableOpacity>
          </View>

          {/* Study mode selection — pick how to learn this deck. Shown above the
              card list, Quizlet-style. Multiple Choice and Zuordnen need at least
              two cards to build questions / pairs. */}
          {!loading && cards.length >= 1 && (
            <View style={{ gap: spacing.sm }}>
              {/* Karteikarten — flip & rate; learns every card of this deck */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/deck-review/[id]",
                    params: { id: deckId, title: deckTitle },
                  })
                }
                activeOpacity={0.7}
                style={studyModeRowStyle}
              >
                <View style={[studyModeIconStyle, { backgroundColor: colors.primaryLight }]}>
                  <Layers size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={studyModeTitleStyle}>Karteikarten</Text>
                  <Text style={studyModeDescStyle}>Klassisch umdrehen & bewerten</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {cards.length >= 2 && (
                <>
                  {/* Multiple Choice — formerly labelled "Test" */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/quiz",
                        params: { deckId, deckTitle },
                      })
                    }
                    activeOpacity={0.7}
                    style={studyModeRowStyle}
                  >
                    <View style={[studyModeIconStyle, { backgroundColor: colors.accentLight }]}>
                      <Brain size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={studyModeTitleStyle}>Multiple Choice</Text>
                      <Text style={studyModeDescStyle}>Antwort aus Optionen wählen</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </TouchableOpacity>

                  {/* Zuordnen — formerly labelled "Match" */}
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/match",
                        params: { deckId, deckTitle },
                      })
                    }
                    activeOpacity={0.7}
                    style={studyModeRowStyle}
                  >
                    <View style={[studyModeIconStyle, { backgroundColor: colors.infoLight }]}>
                      <Puzzle size={18} color={colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={studyModeTitleStyle}>Zuordnen</Text>
                      <Text style={studyModeDescStyle}>Begriffe & Definitionen paaren</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </>
              )}

              {/* Lückentext — type the missing word; works with a single card too */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/cloze",
                    params: { deckId, deckTitle },
                  })
                }
                activeOpacity={0.7}
                style={studyModeRowStyle}
              >
                <View style={[studyModeIconStyle, { backgroundColor: colors.warningLight }]}>
                  <Pencil size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={studyModeTitleStyle}>Lückentext</Text>
                  <Text style={studyModeDescStyle}>Fehlendes aktiv ergänzen</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Test — exam-style: mixed questions, graded at the end */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/test",
                    params: { deckId, deckTitle },
                  })
                }
                activeOpacity={0.7}
                style={studyModeRowStyle}
              >
                <View style={[studyModeIconStyle, { backgroundColor: colors.errorLight }]}>
                  <FileText size={18} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={studyModeTitleStyle}>Test</Text>
                  <Text style={studyModeDescStyle}>Klausur mit Prozent-Ergebnis</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Occlusion — study masked images. The learn screen sends you to
                  the editor when the deck has no occlusion cards yet. deckId is
                  passed so cards are read from / created in THIS deck (#207). */}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/occlusion",
                    params: { deckId, deckTitle },
                  })
                }
                activeOpacity={0.7}
                style={studyModeRowStyle}
              >
                <View style={[studyModeIconStyle, { backgroundColor: colors.successLight }]}>
                  <ImagePlus size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={studyModeTitleStyle}>Occlusion</Text>
                    {/* Statisches Pro-Schild — sagt allen vorab „das ist Pro",
                        statt es erst beim Speichern zu verraten (#364). Bewusst
                        OHNE Tarif-Abfrage: so kann es niemanden fälschlich
                        sperren und kostet keine Anfrage bei jedem Deck-Öffnen.
                        Durchgesetzt wird die Sperre serverseitig (#352). */}
                    <View
                      style={{
                        backgroundColor: colors.accentLight,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: typography.xs,
                          fontWeight: typography.bold,
                          color: colors.accent,
                        }}
                      >
                        Pro
                      </Text>
                    </View>
                  </View>
                  <Text style={studyModeDescStyle}>Bildteile verdecken & abfragen</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Card list */}
          {loading ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : loadError ? (
                /* Ladefehler — ehrlicher Hinweis statt „leeres Deck". Die Karten
                   sind nicht weg, sie konnten nur nicht geladen werden. */
                <View
                  style={{
                    alignItems: "center",
                    paddingTop: 40,
                    gap: spacing.lg,
                    paddingHorizontal: spacing.xl,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    {t("common.loadError")}
                  </Text>
                  <TouchableOpacity
                    onPress={retryLoad}
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
          ) : cards.length === 0 ? (
                <View
                  style={{
                    alignItems: "center",
                    paddingTop: 40,
                    gap: spacing.md,
                  }}
                >
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
                    <CreditCard size={28} color={colors.textTertiary} />
                  </View>
                  <Text
                    style={{
                      fontSize: typography.base,
                      color: colors.textSecondary,
                      textAlign: "center",
                      lineHeight: 22,
                    }}
                  >
                    {/* Wortgleich zum Web (#571): Statt nur zu sagen, dass
                        nichts da ist, erklärt der Satz, was eine Karte
                        ausmacht. Der Weg dorthin ist der "+ Karte"-Knopf über
                        dieser Fläche — dieser Bildschirm hat keinen Weg zum
                        Scannen, weder Knopf noch Menüeintrag. */}
                    Noch keine Karten{"\n"}Füge deine erste Karte hinzu — Vorderseite ist die
                    Frage, Rückseite die Antwort.
                  </Text>
                </View>
          ) : (
            <View style={{ gap: spacing.sm + 2 }}>
              {cards.map((card, idx) => {
                  const meta = difficultyMeta[card.difficulty] ?? {
                    color: colors.textSecondary,
                    label: card.difficulty,
                  };
                  const media = summarizeCardMedia(card);
                  const frontDisplay = media.plainFront || card.front;
                  const backDisplay = media.plainBack || card.back;
                  return (
                    <TouchableOpacity
                      key={card.id}
                      onPress={() => handleEditCard(card)}
                      onLongPress={() => handleCardLongPress(card)}
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
                      {/* Card number + star + difficulty badge */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: spacing.sm,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: typography.xs,
                            color: colors.textTertiary,
                            fontWeight: typography.medium,
                          }}
                        >
                          {/* Bild-Karten hießen hier „Basic" (#612) — der
                              Kopf zählt sie längst getrennt, die Liste nannte
                              sie wie eine gewöhnliche Karteikarte. */}
                          #{idx + 1} · {cardKindLabel(card.type)}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                          <TouchableOpacity
                            onPress={() => handleToggleStar(card)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Star
                              size={16}
                              color={card.starred ? colors.warning : colors.textTertiary}
                              fill={card.starred ? colors.warning : "none"}
                            />
                          </TouchableOpacity>
                          <Text
                            style={{
                              fontSize: typography.xs,
                              color: meta.color,
                              fontWeight: typography.bold,
                              textTransform: "uppercase",
                            }}
                          >
                            {meta.label}
                          </Text>
                        </View>
                      </View>

                      {media.primaryImage ? (
                        <Image
                          source={{ uri: media.primaryImage.url }}
                          style={{
                            width: "100%",
                            height: 140,
                            borderRadius: radius.md,
                            marginBottom: spacing.sm,
                            backgroundColor: colors.surfaceSecondary,
                          }}
                          resizeMode="contain"
                        />
                      ) : null}

                      {/* Front (question) */}
                      <Text
                        style={{
                          fontWeight: typography.semibold,
                          fontSize: typography.base,
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {frontDisplay || media.primaryImage?.alt || "Bildkarte"}
                      </Text>

                      {/* Divider */}
                      <View
                        style={{
                          height: 1,
                          backgroundColor: colors.borderLight,
                          marginVertical: spacing.sm,
                        }}
                      />

                      {/* Back (answer) */}
                      <Text
                        style={{
                          fontSize: typography.sm + 1,
                          color: colors.textSecondary,
                        }}
                        numberOfLines={2}
                      >
                        {backDisplay || media.primaryImage?.alt || "—"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

              {cards.length > 0 && (
                <Text
                  style={{
                    fontSize: typography.xs,
                    color: colors.textTertiary,
                    textAlign: "center",
                    marginTop: spacing.sm,
                  }}
                >
                  Tippe auf eine Karte zum Bearbeiten · Halte gedrückt
                  für mehr Optionen
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Card editor modal */}
        <CardEditor
          visible={editorVisible}
          saving={saving}
          card={
            editingCard
              ? {
                  front: editingCard.front,
                  back: editingCard.back,
                  difficulty: editingCard.difficulty,
                }
              : null
          }
          onSave={handleSaveCard}
          onCancel={() => {
            setEditorVisible(false);
            setEditingCard(null);
          }}
        />

        {/* Deck action sheet (three-dot menu) */}
        <DeckActionSheet
          visible={menuVisible}
          deckTitle={deckTitle}
          onClose={() => setMenuVisible(false)}
          onDownload={handleDownloadOffline}
          onEdit={handleEditDeck}
          onAddToFolder={handleAddToFolder}
          onDuplicate={handleDuplicate}
          onShare={handleShare}
          onRevokeShare={handleRevokeShare}
          onDetails={handleDetails}
          onDelete={handleDeleteDeck}
        />


        {/* Folder picker modal */}
        <FolderPickerModal
          visible={folderPickerVisible}
          deckId={deckId}
          onClose={() => setFolderPickerVisible(false)}
          onAdded={(folder) => {
            Alert.alert(t("common.success"), t("folder.addSuccess", { title: folder.title }));
          }}
        />

        {/* Deck edit modal */}
        <DeckEditModal
          visible={editDeckVisible}
          deckId={deckId}
          currentTitle={currentDeckTitle}
          currentTags={currentDeckTags}
          onClose={() => setEditDeckVisible(false)}
          onSaved={handleDeckSaved}
        />

        {/* Deck details modal */}
        <DeckDetailsModal
          visible={detailsVisible}
          deckId={deckId}
          onClose={() => setDetailsVisible(false)}
        />
    </SafeAreaView>
  );
}
