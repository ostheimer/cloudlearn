import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  Camera,
  FileText,
  ImageIcon,
  PenLine,
  Lightbulb,
  Save,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Link2,
  ArrowLeft,
  Zap,
  Layers,
  Trash2,
  Plus,
  GripVertical,
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { useOcrEditorState } from "../../src/features/ocr/ocrEditorState";
import { normalizeOcrText } from "../../src/features/ocr/normalizeOcrText";
import {
  importPdf,
  importFromUrl,
  scanText,
  scanImage,
  createDeck,
  createCard,
  listCardsInDeck,
  listDecks,
  getLpBalance,
  type Flashcard,
  type Deck,
} from "../../src/lib/api";
import {
  DECK_LIMIT_LABEL,
  deckLimitMessage,
  freeCardSlots,
  isDeckLimitReached,
  deckOverflowWarning,
  isPlanLimitError,
  roomForNewCards,
  savedSummary,
  selectEvenlySpread,
  shouldOpenLpModal,
} from "../../src/lib/importLimits";
import {
  IMPORT_ERROR_TITLE_KEY,
  importErrorKey,
} from "../../src/lib/importErrors";
import { cardTypeLabel, difficultyLabel } from "../../src/lib/cardLabels";
import { summarizeCardMedia } from "../../src/lib/cardMedia";
import {
  blankCard,
  editCardField,
  isCardEditable,
  moveCard,
  nonEmptyCards,
  removeCardAt,
} from "../../src/lib/cardDraft";
import {
  clearScanDraft,
  loadScanDraft,
  saveScanDraft,
  type ScanDraft,
} from "../../src/features/capture/scanDraft";
import {
  getStableImportAttemptKey,
  type ImportAttemptKey,
} from "../../src/features/ocr/importAttemptIdempotency";
import { usageFromBalanceResponse, useUsageStore } from "../../src/store/usageStore";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { LpInsufficientModal } from "../../src/components/LpInsufficientModal";
import TargetDeckPickerModal from "../../src/components/TargetDeckPickerModal";
import { AuthPromptCard } from "../../src/components/AuthPromptCard";
import { LpBadge } from "../../src/components/LpBadge";

type InputMode = "choose" | "camera" | "text" | "url";

// Dieselbe Grenze wie das Web-Textfeld (import/page.tsx MAX_TEXT) — der Server
// lehnt längere Texte mit einem rohen Prüfbericht ab; hier stoppt die Eingabe
// vorher und ein Zähler zeigt, wo man steht (#609).
const MAX_TEXT = 20000;

const getMimeType = (
  uri: string
): "image/jpeg" | "image/png" | "image/webp" => {
  if (uri.toLowerCase().endsWith(".png")) return "image/png";
  if (uri.toLowerCase().endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

// Fotos vor dem Senden verkleinern (#609) — dasselbe Muster wie der
// Occlusion-Editor: längste Seite auf 1600 Bildpunkte, JPEG mit 0,7. Ein
// volles Handyfoto riss sonst die Sendegrenze des Servers ("API error 413");
// für die Karten-Erzeugung reicht die kleine Fassung locker. Schlägt die
// Verkleinerung fehl, geht das Original raus — Scannen bleibt möglich.
const MAX_SCAN_IMAGE_DIM = 1600;
async function shrinkImageForScan(asset: {
  uri: string;
  width?: number;
  height?: number;
  base64?: string | null;
}): Promise<{
  uri: string;
  base64: string | null;
  mime: "image/jpeg" | "image/png" | "image/webp";
}> {
  try {
    const width = asset.width ?? 0;
    const height = asset.height ?? 0;
    const longSide = Math.max(width, height);
    const actions: ImageManipulator.Action[] =
      longSide > MAX_SCAN_IMAGE_DIM
        ? [
            {
              resize:
                width >= height
                  ? { width: MAX_SCAN_IMAGE_DIM }
                  : { height: MAX_SCAN_IMAGE_DIM },
            },
          ]
        : [];
    const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (out.base64) {
      return { uri: out.uri, base64: out.base64, mime: "image/jpeg" };
    }
  } catch {
    // Original weiterverwenden — lieber ein großer Upload als gar keiner.
  }
  return { uri: asset.uri, base64: asset.base64 ?? null, mime: getMimeType(asset.uri) };
}

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const editedText = useOcrEditorState((state) => state.editedText);
  const setOriginalText = useOcrEditorState((state) => state.setOriginalText);
  const setEditedText = useOcrEditorState((state) => state.setEditedText);

  const setUsage = useUsageStore((state) => state.setUsage);
  const deductLp = useUsageStore((state) => state.deductLp);
  const lpBalance = useUsageStore((state) => state.lpBalance);
  const lpCostAiScan = useUsageStore((state) => state.lpCostAiScan);
  const lpCostUrlImport = useUsageStore((state) => state.lpCostUrlImport);
  const lpCostPdfImport = useUsageStore((state) => state.lpCostPdfImport);
  const usageTier = useUsageStore((state) => state.tier);
  const maxDecks = useUsageStore((state) => state.maxDecks);
  const maxCardsPerDeck = useUsageStore((state) => state.maxCardsPerDeck);

  // LP-Insufficient-Modal state
  const [lpModalVisible, setLpModalVisible] = useState(false);
  const [lpModalFeature, setLpModalFeature] = useState<"aiScan" | "urlImport" | "pdfImport">("aiScan");
  const [lpModalCost, setLpModalCost] = useState(0);

  // #603: Nachgeladen wird, solange die GRENZEN unbekannt sind — nicht bis
  // `isLoaded` gesetzt ist. Das alte Tor stand schon zu, sobald irgendwer
  // (das LP-Abzeichen der Startseite) nur den Kontostand geladen hatte, und
  // Pro-Konten blieben für immer auf den Gratis-Vorbelegungen sitzen.
  const limitsKnown = maxDecks !== null && maxCardsPerDeck !== null;
  useEffect(() => {
    if (!userId || limitsKnown) return;
    void getLpBalance()
      .then((data) => setUsage(usageFromBalanceResponse(data)))
      .catch(() => {/* ignore */});
  }, [userId, setUsage, limitsKnown]);

  // Deckliste für die Grenz-Prüfung VOR dem Ausgeben von Lernpunkten (#411).
  // Ziel-Deck-Auswahl fürs Speichern in ein bestehendes Deck (#612).
  const [deckPickerVisible, setDeckPickerVisible] = useState(false);

  // Schlägt sie fehl, bleibt `decksLoaded` false und es wird nichts gesperrt —
  // der Server lehnt dann notfalls ab und bucht die Lernpunkte zurück.
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoaded, setDecksLoaded] = useState(false);

  const reloadDecks = useCallback(async () => {
    if (!userId) return;
    try {
      const { decks: loaded } = await listDecks(userId);
      setDecks(loaded);
      setDecksLoaded(true);
    } catch {
      setDecksLoaded(false);
    }
  }, [userId]);

  useEffect(() => {
    void reloadDecks();
  }, [reloadDecks]);

  const [mode, setMode] = useState<InputMode>("choose");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  // Notlösung statt KI? Der Server meldet das je Scan; nur dieser Zustand
  // wird noch gebraucht — der Modellname selbst wird nicht mehr gezeigt (#609).
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [deckTitle, setDeckTitle] = useState("");
  const [saved, setSaved] = useState(false);
  // Deck created for THIS scan. Kept so a retry after a partial save reuses the
  // same deck instead of creating another one (and re-inserting cards).
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  // #608: Ein auf diesem Gerät gemerkter, unfertiger Entwurf einer FRÜHEREN
  // Sitzung. Wird im Auswahl-Menü nur ANGEBOTEN (Weitermachen/Verwerfen), nie
  // automatisch angewendet — Muster wie das Weitermachen einer Lernrunde.
  const [storedDraft, setStoredDraft] = useState<ScanDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadScanDraft().then((d) => {
      if (!cancelled) setStoredDraft(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // #608: Die Vorschau bei jeder Änderung auf dem Gerät ablegen — die Karten
  // haben Lernpunkte gekostet; beendet das System die App im Hintergrund,
  // darf sie das nicht mehr kosten. Der Ref unterscheidet „Vorschau leer
  // geräumt" (Merker löschen) von „noch keine Vorschau" (gemerkten Entwurf
  // einer früheren Sitzung in Ruhe lassen).
  const hadPreviewRef = useRef(false);
  useEffect(() => {
    if (saved) {
      // Erfolgreich gespeichert — der Entwurf ist am Ziel, der Merker weg.
      if (hadPreviewRef.current) {
        hadPreviewRef.current = false;
        void clearScanDraft();
      }
      return;
    }
    if (cards.length > 0) {
      hadPreviewRef.current = true;
      void saveScanDraft({ cards, deckTitle, savedDeckId });
    } else if (hadPreviewRef.current) {
      hadPreviewRef.current = false;
      void clearScanDraft();
    }
  }, [cards, deckTitle, savedDeckId, saved]);

  const cameraRef = useRef<CameraView>(null);
  const importAttemptRef = useRef<ImportAttemptKey | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const colors = useColors();

  // ─── Reihenfolge per Ziehgriff (#427) ───────────────────────────────────────
  // Übernommen von der Ordner-Sortierung (#437): EIN geteilter PanResponder für
  // alle Griffe, ein Animated.Value für die sichtbare Verschiebung. Anders als
  // bei den Ordnern wird NICHTS gespeichert — die Reihenfolge zählt erst beim
  // „Speichern". `cardsRef` hält den aktuellen Stand für den Fänger, der über
  // die ganze Lebenszeit lebt und keine wandernde Closure sehen darf.
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragState = useRef<{ index: number; baseline: number } | null>(null);
  const rowHeightRef = useRef(0);
  const pendingIndexRef = useRef(0);
  const CARD_GAP = spacing.md;

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
        const slot = rowHeightRef.current + CARD_GAP;
        if (slot <= CARD_GAP) return;
        const rel = gesture.dy - s.baseline;
        if (rel > slot / 2 && s.index < cardsRef.current.length - 1) {
          const from = s.index;
          setCards((prev) => moveCard(prev, from, from + 1));
          s.index += 1;
          s.baseline += slot;
          setDragIndex(s.index);
        } else if (rel < -slot / 2 && s.index > 0) {
          const from = s.index;
          setCards((prev) => moveCard(prev, from, from - 1));
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
      },
      onPanResponderTerminate: () => {
        dragState.current = null;
        dragY.setValue(0);
        setDragIndex(null);
      },
    })
  ).current;


  if (!userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl }}>
          <AuthPromptCard
            title="Mit Konto scannen"
            body="Kamera, Galerie, URLs und PDFs erzeugen nach dem Login echte Flashcards, die wir in deinem Konto speichern."
            onPress={() => router.push("/auth")}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Seit #453 speichert der Server nichts mehr von selbst — gespeichert wird
  // erst im Dialog danach, wahlweise in ein bestehendes Deck. Die Deck-Grenze
  // ist deshalb keine Sackgasse mehr und sperrt das Scannen nicht (wie im Web
  // seit #445): Nur der Weg „Neues Deck" ist zu, der Hinweis oben sagt das an.
  // Unbekannte Grenze (maxDecks === null, #603) sperrt nichts. Der fertige
  // Hinweistext entsteht gleich hier mit, weil deckLimitMessage eine echte
  // Zahl braucht und TypeScript die Kopplung „erreicht ⇒ Zahl" sonst an den
  // Alert-Stellen nicht sieht.
  const deckLimitNotice =
    decksLoaded && maxDecks !== null && isDeckLimitReached(decks.length, maxDecks)
      ? deckLimitMessage(decks.length, maxDecks)
      : null;
  const deckLimitReached = deckLimitNotice !== null;

  const isHttpUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  // --- Image Handling ---

  const handlePickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      // Vor dem Senden verkleinern (#609) — verhindert "zu groß"-Abbrüche.
      const shrunk = await shrinkImageForScan(result.assets[0]);
      setImageUri(shrunk.uri);
      setImageBase64(shrunk.base64);
      setMode("choose");
      if (shrunk.base64) {
        await processImage(shrunk.base64, shrunk.mime);
      }
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      if (photo) {
        // Vor dem Senden verkleinern (#609) — verhindert "zu groß"-Abbrüche.
        const shrunk = await shrinkImageForScan(photo);
        setImageUri(shrunk.uri);
        setImageBase64(shrunk.base64);
        setMode("choose");
        if (shrunk.base64) {
          await processImage(shrunk.base64, shrunk.mime);
        }
      }
    } catch (error) {
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), "Foto konnte nicht aufgenommen werden.");
    }
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Kamera-Zugriff benötigt",
          "Bitte erlaube den Kamera-Zugriff in den Einstellungen."
        );
        return;
      }
    }
    setMode("camera");
  };

  // --- Processing ---

  const getImportAttemptKey = (signature: string, prefix: string): string => {
    const attempt = getStableImportAttemptKey(
      importAttemptRef.current,
      signature,
      prefix
    );
    importAttemptRef.current = attempt;
    return attempt.key;
  };

  const readPickedPdfAsBase64 = async (
    asset: DocumentPicker.DocumentPickerAsset
  ): Promise<string> => {
    if (asset.base64) {
      return asset.base64;
    }

    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => reject(new Error("PDF konnte nicht gelesen werden."));
      xhr.onload = () => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("PDF konnte nicht gelesen werden."));
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("PDF konnte nicht gelesen werden."));
            return;
          }
          const separatorIndex = result.indexOf(",");
          resolve(separatorIndex >= 0 ? result.slice(separatorIndex + 1) : result);
        };
        reader.readAsDataURL(xhr.response as Blob);
      };
      xhr.open("GET", asset.uri, true);
      xhr.responseType = "blob";
      xhr.send();
    });
  };

  const handlePickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: false,
      copyToCacheDirectory: true,
      base64: Platform.OS === "web",
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setPdfFileName(asset.name);
    setPdfPageCount(null);

    try {
      const fileBase64 = await readPickedPdfAsBase64(asset);
      await processPdf(fileBase64, asset.name);
    } catch (error: unknown) {
      // Hier landen nur unsere eigenen deutschen Lese-Fehler (readPickedPdfAsBase64).
      const msg = error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.";
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), msg);
    }
  };

  const processImage = async (
    base64: string,
    mimeType: "image/jpeg" | "image/png" | "image/webp"
  ) => {
    if (!userId) return;
    setLoading(true);
    setCards([]);
    setSaved(false);
    setSourceUrl("");
    setPdfFileName("");
    setPdfPageCount(null);
    try {
      const idempotencyKey = getImportAttemptKey(
        `scan-img:${mimeType}:${base64}`,
        "scan-img"
      );
      // #442: preview → Server speichert nichts, das Deck entsteht erst beim
      // „Speichern" (sonst zwei Decks je Scan).
      const result = await scanImage(userId, base64, mimeType, "de", idempotencyKey, true);
      setCards(result.cards);
      setFallbackUsed(result.fallbackUsed);
      setDeckTitle(result.deckTitle ?? "");
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostAiScan);
      }
    } catch (error: unknown) {
      if (shouldOpenLpModal(error)) {
        setLpModalFeature("aiScan");
        setLpModalCost(lpCostAiScan);
        setLpModalVisible(true);
        return;
      }
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), t(importErrorKey(error, "image")));
    } finally {
      setLoading(false);
    }
  };

  const processPdf = async (fileBase64: string, fileName: string) => {
    if (!userId) return;
    setLoading(true);
    setCards([]);
    setSaved(false);
    setImageUri(null);
    setImageBase64(null);
    setSourceUrl("");
    setPdfFileName(fileName);
    setPdfPageCount(null);

    try {
      const idempotencyKey = getImportAttemptKey(
        `import-pdf:${fileName}:${fileBase64}`,
        "import-pdf"
      );
      // #442: preview — Deck entsteht erst beim „Speichern".
      const result = await importPdf(userId, fileName, fileBase64, "de", idempotencyKey, true);
      setCards(result.cards);
      setFallbackUsed(result.fallbackUsed);
      setDeckTitle(result.deckTitle ?? "");
      setPdfFileName(result.fileName);
      setPdfPageCount(result.pageCount);
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostPdfImport);
      }
    } catch (error: unknown) {
      if (shouldOpenLpModal(error)) {
        setLpModalFeature("pdfImport");
        setLpModalCost(lpCostPdfImport);
        setLpModalVisible(true);
        return;
      }
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), t(importErrorKey(error, "pdf")));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromText = async () => {
    if (!editedText.trim() || !userId) return;
    setLoading(true);
    setCards([]);
    setSaved(false);
    setImageUri(null);
    setImageBase64(null);
    setSourceUrl("");
    setPdfFileName("");
    setPdfPageCount(null);
    try {
      // Aufräumen erst hier statt bei jedem Tastendruck (#609) — die Eingabe
      // selbst bleibt unangetastet, sonst frisst der Editor Leerzeichen.
      const text = normalizeOcrText(editedText);
      const idempotencyKey = getImportAttemptKey(`scan:${text}`, "scan");
      // #442: preview — Deck entsteht erst beim „Speichern".
      const result = await scanText(userId, text, "de", idempotencyKey, true);
      setCards(result.cards);
      setFallbackUsed(result.fallbackUsed);
      setDeckTitle(result.deckTitle ?? "");
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostAiScan);
      }
    } catch (error: unknown) {
      if (shouldOpenLpModal(error)) {
        setLpModalFeature("aiScan");
        setLpModalCost(lpCostAiScan);
        setLpModalVisible(true);
        return;
      }
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), t(importErrorKey(error, "text")));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromUrl = async () => {
    if (!userId) return;
    const normalizedUrl = sourceUrl.trim();
    if (!isHttpUrl(normalizedUrl)) {
      Alert.alert("Ungültige URL", "Bitte gib eine gültige http(s)-URL ein.");
      return;
    }

    setLoading(true);
    setCards([]);
    setSaved(false);
    setImageUri(null);
    setImageBase64(null);
    setPdfFileName("");
    setPdfPageCount(null);

    try {
      const idempotencyKey = getImportAttemptKey(
        `import-url:${normalizedUrl}`,
        "import-url"
      );
      // #442: preview — Deck entsteht erst beim „Speichern".
      const result = await importFromUrl(userId, normalizedUrl, 4, "de", idempotencyKey, true);
      setCards(result.cards);
      setFallbackUsed(result.fallbackUsed);
      setDeckTitle(result.deckTitle ?? "");
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostUrlImport);
      }
    } catch (error: unknown) {
      if (shouldOpenLpModal(error)) {
        setLpModalFeature("urlImport");
        setLpModalCost(lpCostUrlImport);
        setLpModalVisible(true);
        return;
      }
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), t(importErrorKey(error, "url")));
    } finally {
      setLoading(false);
    }
  };

  // #427: Karten in der Vorschau ändern oder einzeln wegwerfen — vor dem
  // Speichern, wie im Web. `cards` ist die Quelle, aus der saveCardsToDeck
  // schöpft, also fließt jede Änderung automatisch mit.
  const editCard = (index: number, side: "front" | "back", value: string) => {
    setCards((prev) => editCardField(prev, index, side, value));
  };
  const removeCard = (index: number) => {
    setCards((prev) => removeCardAt(prev, index));
  };
  // #427: Eine leere Karte anhängen, die die Nutzerin selbst ausfüllt.
  const addCard = () => {
    setCards((prev) => [...prev, blankCard()]);
  };

  const saveCardsToDeck = async (deckId: string, title: string) => {
    if (!userId) return;
    // #427: Selbst hinzugefügte, leer gelassene Karten fallen hier raus — sie
    // sollen kein leeres Kärtchen anlegen und nicht den Server-Check reißen.
    const savable = nonEmptyCards(cards);
    if (savable.length === 0) {
      Alert.alert("Nichts zu speichern", "Bitte fülle mindestens eine Karte aus.");
      return;
    }
    setSaving(true);
    try {
      // Resume-safe: a previous attempt may have created the deck and inserted
      // some cards before failing. Read what's already in the deck and skip those
      // (matched on front+back) so a retry doesn't duplicate cards.
      let existingKeys = new Set<string>();
      let existingCount: number | null = null;
      try {
        const { cards: existing } = await listCardsInDeck(deckId);
        existingKeys = new Set(existing.map((c) => JSON.stringify([c.front, c.back])));
        existingCount = existing.length;
      } catch {
        // Couldn't read existing cards — fall back to inserting all (best effort).
      }

      const pending = savable.filter(
        (card) => !existingKeys.has(JSON.stringify([card.front, card.back]))
      );
      // #411: Passt das Kapitel nicht mehr ganz ins Deck, wird gleichmäßig über
      // den ganzen Stoff ausgedünnt statt hinten abgeschnitten. Gekürzt wird
      // nur, wenn Deck-Bestand UND Server-Grenze wirklich bekannt sind (#603) —
      // fehlt eines, entscheidet der Server.
      const toSave = selectEvenlySpread(
        pending,
        roomForNewCards(pending.length, existingCount, maxCardsPerDeck)
      );

      for (const card of toSave) {
        await createCard(userId, deckId, card);
      }

      setSaved(true);
      void reloadDecks();

      const savedCount = toSave.length + (savable.length - pending.length);
      Alert.alert(
        "Gespeichert!",
        `${savedSummary(savable.length, savedCount)}\nDeck: "${title}"`,
        [
          {
            text: "Deck öffnen",
            onPress: () =>
              router.push(`/deck/${deckId}?title=${encodeURIComponent(title)}`),
          },
        ]
      );
    } catch (error: unknown) {
      // Tarifgrenzen (409) sprechen schon gutes Deutsch vom Server — die
      // bleiben; alles andere übersetzt importErrors (#609).
      if (isPlanLimitError(error) && error instanceof Error) {
        Alert.alert(DECK_LIMIT_LABEL, error.message);
      } else {
        Alert.alert(t(IMPORT_ERROR_TITLE_KEY), t(importErrorKey(error, "save")));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewDeck = async () => {
    if (!userId || cards.length === 0) return;
    // Hier — und nur hier — sperrt die Deck-Grenze noch: Genau diese Aktion
    // legt ein NEUES Deck an. Der Dialog fängt das schon ab; dies ist das Netz
    // für eine veraltete Deck-Liste.
    if (deckLimitNotice) {
      Alert.alert(DECK_LIMIT_LABEL, deckLimitNotice);
      return;
    }
    const title =
      deckTitle || `Scan ${new Date().toLocaleDateString("de")}`;
    // Retry after a partial save: a deck was already created for this scan, so
    // reuse it instead of creating a second one. saveCardsToDeck then skips the
    // cards it already inserted, so no duplicate deck and no duplicate cards.
    if (savedDeckId) {
      await saveCardsToDeck(savedDeckId, title);
      return;
    }
    setSaving(true);
    try {
      const { deck } = await createDeck(userId, title, ["scan", "auto"]);
      // Remember the deck up front so a failure in the card loop below still lets
      // a retry reuse this exact deck.
      setSavedDeckId(deck.id);
      void reloadDecks();
      await saveCardsToDeck(deck.id, deck.title);
    } catch (error: unknown) {
      if (isPlanLimitError(error) && error instanceof Error) {
        Alert.alert(DECK_LIMIT_LABEL, error.message);
      } else {
        Alert.alert(t(IMPORT_ERROR_TITLE_KEY), t(importErrorKey(error, "save")));
      }
      setSaving(false);
    }
  };

  /**
   * #411: Vor dem Schreiben prüfen, wie viel im Ziel-Deck noch frei ist. Ein
   * volles Deck wird gar nicht erst angeboten, bei wenig Platz entscheidet die
   * Nutzerin selbst — statt dass der Server mittendrin abbricht.
   */
  const confirmSaveToDeck = (deck: Deck) => {
    // #603: Bei unbekannter Server-Grenze ist `free` null — dann wird weder
    // gesperrt noch gewarnt, sondern gespeichert; die echte Grenze hält der
    // Server beim Schreiben selbst.
    const free = freeCardSlots(deck, maxCardsPerDeck);
    if (maxCardsPerDeck !== null && free === 0) {
      Alert.alert(
        "Deck voll",
        `"${deck.title}" hat bereits ${maxCardsPerDeck} Karten. Wähle ein anderes Deck.`
      );
      return;
    }
    // #570 (Laras Variante 3): Nachfrage nur, wenn die neuen Karten nicht mehr
    // alle passen — gezählt wird, was wirklich gespeichert würde (ohne leere).
    const warning = deckOverflowWarning(free, nonEmptyCards(cards).length);
    if (warning) {
      Alert.alert("Wenig Platz", warning, [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Trotzdem speichern",
          onPress: () => void saveCardsToDeck(deck.id, deck.title),
        },
      ]);
      return;
    }
    void saveCardsToDeck(deck.id, deck.title);
  };

  const handleSaveToExistingDeck = async () => {
    if (!userId) return;
    try {
      const { decks: existingDecks } = await listDecks(userId);
      setDecks(existingDecks);
      setDecksLoaded(true);
      if (existingDecks.length === 0) {
        Alert.alert(
          "Keine Decks",
          "Du hast noch keine Decks. Es wird ein neues erstellt.",
          [{ text: "OK", onPress: handleSaveNewDeck }]
        );
        return;
      }
      // Eigenes Auswahl-Fenster statt Alert (#612, #571-Teil-C): der Alert
      // zeigte höchstens 8 Decks (Android real ~2–3), ohne Scrollen und ohne
      // Suche — Deck Nr. 9+ war als Ziel unerreichbar.
      setDeckPickerVisible(true);
    } catch {
      Alert.alert(t(IMPORT_ERROR_TITLE_KEY), "Decks konnten nicht geladen werden.");
    }
  };

  const handleSaveAndLearn = () => {
    if (!userId || cards.length === 0) return;
    // Die Dialog-Kette zählt nur nicht-leere Karten (#595): gespeichert wird
    // ohnehin nur `savable` (saveCardsToDeck), und die Platz-Rückfrage darunter
    // zählt schon so — sonst nennen zwei Dialoge nacheinander andere Zahlen.
    // #411: An der Deck-Grenze wird „Neues Deck" nicht als funktionierende
    // Möglichkeit angeboten — der Hinweis steht direkt an der Schaltfläche,
    // damit die Nutzerin gleich ein bestehendes Deck wählt statt zu scheitern.
    Alert.alert("Karten speichern", `${nonEmptyCards(cards).length} Karten speichern in:`, [
      {
        text: deckLimitReached ? `Neues Deck (${DECK_LIMIT_LABEL})` : "Neues Deck",
        onPress: () => {
          if (deckLimitNotice) {
            Alert.alert(DECK_LIMIT_LABEL, deckLimitNotice);
            return;
          }
          void handleSaveNewDeck();
        },
      },
      { text: "Bestehendes Deck", onPress: handleSaveToExistingDeck },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const resetAll = () => {
    setCards([]);
    setFallbackUsed(false);
    setDeckTitle("");
    setSaved(false);
    setSavedDeckId(null);
    setImageUri(null);
    setImageBase64(null);
    setMode("choose");
    setEditedText("");
    setSourceUrl("");
    setPdfFileName("");
    setPdfPageCount(null);
    importAttemptRef.current = null;
  };

  // ─── #608: Gemerkten Entwurf einer früheren Sitzung fortsetzen/verwerfen ──
  const resumeStoredDraft = () => {
    if (!storedDraft) return;
    setCards(storedDraft.cards);
    setDeckTitle(storedDraft.deckTitle);
    // Deck eines teil-gescheiterten Speicherversuchs weiterverwenden — sonst
    // legte „Speichern" nach dem Fortsetzen ein zweites Deck an.
    setSavedDeckId(storedDraft.savedDeckId);
    setSaved(false);
    setStoredDraft(null);
  };

  const discardStoredDraft = () => {
    if (!storedDraft) return;
    // Gleiche Nachfrage wie beim Verwerfen der offenen Vorschau (startNewScan):
    // die gemerkten Karten sind genauso bezahlt.
    Alert.alert(
      "Karten verwerfen?",
      `Du hast ${storedDraft.cards.length} gemerkte Karten, die noch nicht gespeichert ` +
        `sind. Wenn du sie verwirfst, sind sie weg — die Lernpunkte kommen nicht zurück.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Verwerfen",
          style: "destructive",
          onPress: () => {
            void clearScanDraft();
            setStoredDraft(null);
          },
        },
      ]
    );
  };

  // #442: Seit der Vorschau speichert der Scan nicht mehr automatisch. „Neuen
  // Scan starten" würde die erzeugten Karten also verwerfen — und die dafür
  // gezahlten Lernpunkte kommen nicht zurück (die KI hat gearbeitet). Vorher
  // erst fragen, damit niemand seine Karten aus Versehen wegwirft.
  const startNewScan = () => {
    if (!saved && cards.length > 0) {
      Alert.alert(
        "Karten verwerfen?",
        `Du hast ${cards.length} Karten, die noch nicht gespeichert sind. Wenn du neu ` +
          `scannst, sind sie weg — die Lernpunkte kommen nicht zurück.`,
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Verwerfen", style: "destructive", onPress: resetAll },
        ]
      );
      return;
    }
    resetAll();
  };

  // --- Camera View ---
  if (mode === "camera") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              alignItems: "center",
              paddingBottom: 40,
            }}
          >
            {/* Shutter button */}
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surface,
                borderWidth: 4,
                borderColor: "rgba(255,255,255,0.5)",
                marginBottom: spacing.lg,
              }}
            />
            {/* Cancel button */}
            <TouchableOpacity
              onPress={() => setMode("choose")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <ArrowLeft size={18} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontSize: typography.lg,
                  fontWeight: typography.semibold,
                }}
              >
                Abbrechen
              </Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  // --- Text Input View ---
  if (mode === "text") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: typography.xxl,
                fontWeight: typography.bold,
                color: colors.text,
              }}
            >
              Text eingeben
            </Text>
            <TouchableOpacity
              onPress={() => setMode("choose")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <ArrowLeft size={16} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                }}
              >
                Zurück
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            multiline
            value={editedText}
            onChangeText={setEditedText}
            maxLength={MAX_TEXT}
            placeholder="Tippe oder füge hier deinen Lerntext ein..."
            placeholderTextColor={colors.textTertiary}
            style={{
              minHeight: 180,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: 14,
              fontSize: typography.base,
              backgroundColor: colors.surface,
              textAlignVertical: "top",
            }}
          />
          {/* Zeichen-Zähler wie im Web (#609) — die Grenze sieht man, bevor
              sie zuschlägt. */}
          <Text
            style={{
              alignSelf: "flex-end",
              fontSize: typography.xs,
              color: colors.textTertiary,
            }}
          >
            {t("scan.charCount", {
              current: editedText.length.toLocaleString("de-DE"),
              max: MAX_TEXT.toLocaleString("de-DE"),
            })}
          </Text>

          {/* Example text */}
          {!editedText && (
            <TouchableOpacity
              onPress={() =>
                setOriginalText(
                  "Die Mitochondrien sind das Kraftwerk der Zelle. Sie erzeugen ATP durch oxidative Phosphorylierung. Die innere Membran ist stark gefaltet und bildet die Cristae."
                )
              }
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: typography.medium,
                }}
              >
                Beispieltext laden
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleGenerateFromText}
            disabled={loading || !editedText.trim()}
            activeOpacity={0.8}
            style={{
              backgroundColor:
                loading || !editedText.trim()
                  ? colors.textTertiary
                  : colors.primary,
              borderRadius: radius.md,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Sparkles size={18} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.lg, fontWeight: typography.bold }}>
                  {t("scan.generateBtn")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Zap size={13} color={colors.textInverse} />
                  <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                    {lpCostAiScan} LP
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === "url") {
    const validUrl = isHttpUrl(sourceUrl);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: typography.xxl,
                fontWeight: typography.bold,
                color: colors.text,
              }}
            >
              URL importieren
            </Text>
            <TouchableOpacity
              onPress={() => setMode("choose")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <ArrowLeft size={16} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                }}
              >
                Zurück
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: typography.base,
              lineHeight: 22,
            }}
          >
            Gib eine URL ein. Text und relevante Bilder der Seite werden in Karten
            und Quizfragen übernommen.
          </Text>

          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === "ios" ? "url" : "default"}
            placeholder="https://beispiel.de/artikel"
            placeholderTextColor={colors.textTertiary}
            style={{
              borderWidth: 1,
              borderColor: validUrl || sourceUrl.length === 0 ? colors.border : colors.error,
              borderRadius: radius.md,
              padding: 14,
              fontSize: typography.base,
              backgroundColor: colors.surface,
              color: colors.text,
            }}
          />

          <TouchableOpacity
            onPress={handleGenerateFromUrl}
            disabled={loading || !validUrl}
            activeOpacity={0.8}
            style={{
              backgroundColor:
                loading || !validUrl ? colors.textTertiary : colors.primary,
              borderRadius: radius.md,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Sparkles size={18} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.lg, fontWeight: typography.bold }}>
                  {t("scan.analyzeBtn")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Zap size={13} color={colors.textInverse} />
                  <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                    {lpCostUrlImport} LP
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Main Choose Mode + Results View ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text
            style={{
              fontSize: typography.xxl,
              fontWeight: typography.bold,
              color: colors.text,
            }}
          >
            {cards.length > 0 ? t("scan.resultTitle") : t("scan.title")}
          </Text>

          {/* LP balance badge */}
          <LpBadge onPress={() => router.push("/lp-store")} />
        </View>

        {/* #608: Ein gemerkter, unfertiger Entwurf wird angeboten, nie
            automatisch geöffnet — wie das Weitermachen einer Lernrunde. */}
        {storedDraft && cards.length === 0 && !loading && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: colors.primary,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.xs,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: typography.base,
                fontWeight: typography.semibold,
              }}
            >
              Unfertiger Import
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
              {storedDraft.cards.length} erstellte{" "}
              {storedDraft.cards.length === 1 ? "Karte wurde" : "Karten wurden"} noch nicht
              gespeichert.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <TouchableOpacity
                onPress={resumeStoredDraft}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.sm,
                }}
              >
                <Text
                  style={{
                    color: "#ffffff",
                    fontWeight: typography.semibold,
                    fontSize: typography.sm,
                  }}
                >
                  Weitermachen
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={discardStoredDraft}
                activeOpacity={0.85}
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>
                  Verwerfen
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* LP insufficient hint */}
        {lpBalance < lpCostAiScan && cards.length === 0 && !loading && (
          <TouchableOpacity
            onPress={() => { setLpModalFeature("aiScan"); setLpModalCost(lpCostAiScan); setLpModalVisible(true); }}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.warningLight,
              borderRadius: radius.md,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: colors.warning,
            }}
          >
            <Zap size={16} color={colors.warning} />
            <Text style={{ flex: 1, color: colors.text, fontSize: typography.sm }}>
              {t("lp.insufficientHint", { cost: lpCostAiScan, balance: lpBalance })}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text style={{ color: colors.warning, fontSize: typography.xs, fontWeight: typography.semibold }}>
                {t("lp.earnMore")}
              </Text>
              <ChevronRight size={12} color={colors.warning} />
            </View>
          </TouchableOpacity>
        )}

        {/* #411/#427: Deck-Grenze — informieren statt sperren. Scannen bleibt
            möglich; zu ist nur „Neues Deck" im Speichern-Dialog. */}
        {deckLimitReached && cards.length === 0 && !loading && (
          <View
            style={{
              backgroundColor: colors.warningLight,
              borderRadius: radius.md,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: colors.warning,
            }}
          >
            <Layers size={16} color={colors.warning} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sm,
                  fontWeight: typography.semibold,
                }}
              >
                {DECK_LIMIT_LABEL}
              </Text>
              <Text style={{ color: colors.text, fontSize: typography.sm, lineHeight: 19 }}>
                {deckLimitNotice}
              </Text>
            </View>
          </View>
        )}

        {/* LpInsufficientModal */}
        <LpInsufficientModal
          visible={lpModalVisible}
          cost={lpModalCost}
          balance={lpBalance}
          feature={lpModalFeature}
          onClose={() => setLpModalVisible(false)}
          onAdRewarded={(newBalance) => setUsage({ lpBalance: newBalance })}
        />

        {/* Ziel-Deck wählen (#612) — die Platz-Nachfragen übernimmt weiterhin
            confirmSaveToDeck, das Fenster wählt nur aus. */}
        <TargetDeckPickerModal
          visible={deckPickerVisible}
          cardCount={nonEmptyCards(cards).length}
          decks={decks}
          maxCardsPerDeck={maxCardsPerDeck}
          onClose={() => setDeckPickerVisible(false)}
          onSelect={(deck) => {
            setDeckPickerVisible(false);
            confirmSaveToDeck(deck);
          }}
        />

        {/* Loading overlay */}
        {(loading || saving) && (
          <View
            style={{
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: spacing.xxxl,
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <ActivityIndicator
              size="large"
              color={saving ? colors.success : colors.primary}
            />
            <Text
              style={{
                fontSize: typography.lg,
                color: colors.text,
                fontWeight: typography.semibold,
              }}
            >
              {saving
                ? "Karten werden gespeichert..."
                : imageUri
                  ? "Bild wird analysiert..."
                  : sourceUrl.trim()
                    ? "URL wird analysiert..."
                    : pdfFileName
                      ? "PDF wird analysiert..."
                    : "Flashcards werden generiert..."}
            </Text>
            <Text
              style={{ fontSize: typography.sm, color: colors.textSecondary }}
            >
              {saving
                ? `${cards.length} Karten werden in deinem Deck gespeichert`
                : pdfFileName
                  ? `${pdfFileName} wird verarbeitet`
                  : "Gemini AI verarbeitet dein Material"}
            </Text>
          </View>
        )}

        {/* Input mode buttons */}
        {cards.length === 0 && !loading && (
          <View style={{ gap: spacing.md }}>
            {imageUri && (
              <View style={{ alignItems: "center", marginBottom: spacing.sm }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: "100%",
                    height: 200,
                    borderRadius: radius.md,
                  }}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Camera button */}
            <TouchableOpacity
              onPress={openCamera}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                padding: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                ...shadows.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Camera size={24} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Foto aufnehmen
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: typography.sm, marginTop: 2 }}>
                  {t("scan.cameraHint")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Zap size={13} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                  {lpCostAiScan} LP
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* Gallery button */}
            <TouchableOpacity
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.success,
                borderRadius: radius.lg,
                padding: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                ...shadows.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ImageIcon size={24} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Aus Galerie wählen
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: typography.sm, marginTop: 2 }}>
                  {t("scan.galleryHint")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Zap size={13} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                  {lpCostAiScan} LP
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* Text input button */}
            <TouchableOpacity
              onPress={() => setMode("text")}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.warning,
                borderRadius: radius.lg,
                padding: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                ...shadows.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <PenLine size={24} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Text eingeben
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: typography.sm, marginTop: 2 }}>
                  {t("scan.textHint")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Zap size={13} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                  {lpCostAiScan} LP
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* URL import button */}
            <TouchableOpacity
              onPress={() => setMode("url")}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.info,
                borderRadius: radius.lg,
                padding: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                ...shadows.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Link2 size={24} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  URL importieren
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: typography.sm, marginTop: 2 }}>
                  {t("scan.urlHint")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Zap size={13} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                  {lpCostUrlImport} LP
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* PDF import button */}
            <TouchableOpacity
              onPress={handlePickPdf}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.text,
                borderRadius: radius.lg,
                padding: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                ...shadows.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(255,255,255,0.16)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <FileText size={24} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  PDF importieren
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: typography.sm, marginTop: 2 }}>
                  Text-PDF direkt in Lernkarten umwandeln
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Zap size={13} color={colors.textInverse} />
                <Text style={{ color: colors.textInverse, fontSize: typography.xs, fontWeight: typography.bold }}>
                  {lpCostPdfImport} LP
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>

            {/* Info text */}
            <View
              style={{
                backgroundColor: colors.infoLight,
                borderRadius: radius.md,
                padding: 14,
                marginTop: spacing.xs,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: spacing.md,
              }}
            >
              <Lightbulb
                size={18}
                color={colors.info}
                style={{ marginTop: 1 }}
              />
              <Text
                style={{
                  color: colors.info,
                  fontSize: typography.sm,
                  lineHeight: 20,
                  flex: 1,
                }}
              >
                Gemini AI analysiert dein Material und erstellt automatisch
                Flashcards aus Fotos, Screenshots, PDFs oder Text.
              </Text>
            </View>
          </View>
        )}

        {/* Generated cards */}
        {cards.length > 0 && !loading && (
          <View style={{ gap: spacing.md }}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: radius.md,
                }}
                resizeMode="cover"
              />
            )}

            {pdfFileName ? (
              <View
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.text,
                      fontSize: typography.base,
                      fontWeight: typography.semibold,
                    }}
                  >
                    {pdfFileName}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sm,
                    }}
                  >
                    {pdfPageCount ? `${pdfPageCount} Seiten importiert` : "PDF-Import"}
                  </Text>
                </View>
                <FileText size={18} color={colors.textSecondary} />
              </View>
            ) : null}

            {deckTitle ? (
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.bold,
                  color: colors.text,
                }}
              >
                {deckTitle}
              </Text>
            ) : null}

            {/* Kopfzeile der Vorschau (#609): Der Modellname („via
                gemini-2.0-flash", im Notfall „via heuristic-fallback") sagt
                niemandem etwas und ist weg. Stattdessen der Satz aus dem Web,
                der die wichtigste Frage beantwortet: Ist das schon gespeichert?
                Nein — erst nach dem Speichern-Knopf. */}
            <View style={{ gap: 2 }}>
              <Text
                style={{
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                }}
              >
                {cards.length === 1 ? "1 Karte erstellt" : `${cards.length} Karten erstellt`}
              </Text>
              <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>
                Sieh sie dir an und ändere, was nicht passt — gespeichert wird erst danach.
              </Text>
            </View>

            {/* Ehrlich bleiben, wenn die KI nicht erreichbar war: Dann hat eine
                einfache Notlösung den Text nur grob zerteilt, und die Karten
                sind spürbar schlechter. Der Server meldet das als
                `fallbackUsed` — verlässlicher als der Modellname. */}
            {fallbackUsed ? (
              <View
                style={{
                  backgroundColor: colors.warningLight,
                  borderWidth: 1,
                  borderColor: colors.warning,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              >
                <Text style={{ fontSize: typography.sm, color: colors.text }}>
                  Ohne KI erstellt — die Karten sind nur grob aufgeteilt.
                </Text>
              </View>
            ) : null}

            {cards.map((card, idx) => {
              const media = summarizeCardMedia(card);
              const editable = isCardEditable(card, media);
              const frontDisplay = (media.plainFront || card.front).replace(
                /\{\{c\d+::(.+?)\}\}/g,
                "[$1]"
              );
              const backDisplay = media.plainBack || card.back;
              return (
                <Animated.View
                  key={idx}
                  onLayout={
                    idx === 0
                      ? (e) => {
                          rowHeightRef.current = e.nativeEvent.layout.height;
                        }
                      : undefined
                  }
                  style={
                    dragIndex === idx
                      ? {
                          transform: [{ translateY: dragY }, { scale: 1.02 }],
                          zIndex: 2,
                          opacity: 0.95,
                        }
                      : undefined
                  }
                >
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: dragIndex === idx ? colors.primary : colors.border,
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        {/* Ziehgriff — nur wenn Sortieren etwas bewirken kann */}
                        {cards.length > 1 && (
                          <View
                            accessible
                            accessibilityLabel={`Karte ${idx + 1} verschieben`}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            // onTouchStart feuert vor der Responder-Vergabe und
                            // sagt dem geteilten Fänger, WELCHE Karte gezogen wird.
                            onTouchStart={() => {
                              pendingIndexRef.current = idx;
                            }}
                            {...gripResponder.panHandlers}
                          >
                            <GripVertical size={18} color={colors.textTertiary} />
                          </View>
                        )}
                        <Text
                          style={{
                            fontSize: typography.xs,
                            fontWeight: typography.semibold,
                            color: colors.textTertiary,
                          }}
                        >
                          Karte {idx + 1}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeCard(idx)}
                        disabled={saving}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Karte ${idx + 1} löschen`}
                      >
                        <Trash2 size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>

                  {media.primaryImage ? (
                    <Image
                      source={{ uri: media.primaryImage.url }}
                      style={{
                        width: "100%",
                        height: 160,
                        borderRadius: radius.md,
                        backgroundColor: colors.surfaceSecondary,
                      }}
                      resizeMode="contain"
                    />
                  ) : null}

                  {editable ? (
                    <>
                      <TextInput
                        value={card.front}
                        onChangeText={(value) => editCard(idx, "front", value)}
                        editable={!saving}
                        multiline
                        placeholder="Frage"
                        placeholderTextColor={colors.textTertiary}
                        style={{
                          fontWeight: typography.semibold,
                          fontSize: typography.base,
                          color: colors.text,
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: radius.sm,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.sm,
                        }}
                      />
                      <TextInput
                        value={card.back}
                        onChangeText={(value) => editCard(idx, "back", value)}
                        editable={!saving}
                        multiline
                        placeholder="Antwort"
                        placeholderTextColor={colors.textTertiary}
                        style={{
                          fontSize: typography.sm + 1,
                          color: colors.textSecondary,
                          backgroundColor: colors.surfaceSecondary,
                          borderRadius: radius.sm,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.sm,
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontWeight: typography.semibold,
                          fontSize: typography.base,
                          color: colors.text,
                        }}
                      >
                        {frontDisplay || media.primaryImage?.alt || "Bildkarte"}
                      </Text>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: typography.sm + 1,
                        }}
                      >
                        {backDisplay || media.primaryImage?.alt || "—"}
                      </Text>
                    </>
                  )}

                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Text
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
                      {cardTypeLabel(card.type)}
                    </Text>
                    <Text
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
                      {difficultyLabel(card.difficulty)}
                    </Text>
                  </View>
                  </View>
                </Animated.View>
              );
            })}

            {/* #427: Karte von Hand hinzufügen, wenn etwas fehlt */}
            {!saved && (
              <TouchableOpacity
                onPress={addCard}
                disabled={saving}
                activeOpacity={0.8}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: "dashed",
                  borderRadius: radius.md,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
              >
                <Plus size={18} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                  }}
                >
                  Karte hinzufügen
                </Text>
              </TouchableOpacity>
            )}

            {/* Save and learn */}
            {!saved && (
              <TouchableOpacity
                onPress={handleSaveAndLearn}
                disabled={saving}
                activeOpacity={0.8}
                style={{
                  backgroundColor: colors.success,
                  borderRadius: radius.md,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                  ...shadows.md,
                }}
              >
                <Save size={18} color={colors.textInverse} />
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Speichern & Lernen
                </Text>
              </TouchableOpacity>
            )}

            {/* New scan */}
            <TouchableOpacity
              onPress={startNewScan}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
            >
              <RotateCcw size={16} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.base,
                  fontWeight: typography.semibold,
                }}
              >
                Neuen Scan starten
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
