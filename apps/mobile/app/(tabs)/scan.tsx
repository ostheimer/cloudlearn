import { useState, useRef, useEffect } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
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
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { useOcrEditorState } from "../../src/features/ocr/ocrEditorState";
import {
  importPdf,
  importFromUrl,
  isApiError,
  scanText,
  scanImage,
  createDeck,
  createCard,
  listDecks,
  getLpBalance,
  type Flashcard,
  type Deck,
} from "../../src/lib/api";
import { summarizeCardMedia } from "../../src/lib/cardMedia";
import { useReviewSession } from "../../src/features/review/reviewSession";
import { useUsageStore } from "../../src/store/usageStore";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";
import { LpInsufficientModal } from "../../src/components/LpInsufficientModal";
import { AuthPromptCard } from "../../src/components/AuthPromptCard";
import { LpBadge } from "../../src/components/LpBadge";

type InputMode = "choose" | "camera" | "text" | "url";

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const editedText = useOcrEditorState((state) => state.editedText);
  const setOriginalText = useOcrEditorState((state) => state.setOriginalText);
  const setEditedText = useOcrEditorState((state) => state.setEditedText);
  const startReview = useReviewSession((state) => state.start);

  const setUsage = useUsageStore((state) => state.setUsage);
  const deductLp = useUsageStore((state) => state.deductLp);
  const lpBalance = useUsageStore((state) => state.lpBalance);
  const lpCostAiScan = useUsageStore((state) => state.lpCostAiScan);
  const lpCostUrlImport = useUsageStore((state) => state.lpCostUrlImport);
  const lpCostPdfImport = useUsageStore((state) => state.lpCostPdfImport);
  const usageTier = useUsageStore((state) => state.tier);
  const isUsageLoaded = useUsageStore((state) => state.isLoaded);

  // LP-Insufficient-Modal state
  const [lpModalVisible, setLpModalVisible] = useState(false);
  const [lpModalFeature, setLpModalFeature] = useState<"aiScan" | "urlImport" | "pdfImport">("aiScan");
  const [lpModalCost, setLpModalCost] = useState(0);

  useEffect(() => {
    if (!userId || isUsageLoaded) return;
    void getLpBalance().then((data) => setUsage({
      tier: data.tier,
      lpBalance: data.lpBalance,
      lpEarnedToday: data.lpEarnedToday,
      lpAdsToday: data.lpAdsToday,
      lpEarnCapToday: data.lpEarnCapToday,
      lpAdCapToday: data.lpAdCapToday,
      lpCostAiScan: data.lpCostAiScan,
      lpCostUrlImport: data.lpCostUrlImport,
      lpCostPdfImport: data.lpCostPdfImport,
      periodStart: data.periodStart,
    })).catch(() => {/* ignore */});
  }, [userId, setUsage, isUsageLoaded]);

  const [mode, setMode] = useState<InputMode>("choose");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [model, setModel] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const colors = useColors();

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
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setMode("choose");
      if (asset.base64) {
        await processImage(asset.base64, getMimeType(asset.uri));
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
        setImageUri(photo.uri);
        setImageBase64(photo.base64 ?? null);
        setMode("choose");
        if (photo.base64) {
          await processImage(photo.base64, "image/jpeg");
        }
      }
    } catch (error) {
      Alert.alert("Fehler", "Foto konnte nicht aufgenommen werden.");
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

  const getMimeType = (
    uri: string
  ): "image/jpeg" | "image/png" | "image/webp" => {
    if (uri.toLowerCase().endsWith(".png")) return "image/png";
    if (uri.toLowerCase().endsWith(".webp")) return "image/webp";
    return "image/jpeg";
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
      const msg = error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.";
      Alert.alert("Fehler beim PDF-Import", msg);
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
      const result = await scanImage(userId, base64, mimeType);
      setCards(result.cards);
      setModel(result.model);
      setDeckTitle(result.deckTitle ?? "");
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostAiScan);
      }
    } catch (error: unknown) {
      if (isApiError(error) && (error.code === "INSUFFICIENT_LP" || error.status === 402)) {
        setLpModalFeature("aiScan");
        setLpModalCost(lpCostAiScan);
        setLpModalVisible(true);
        return;
      }
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler bei der Bildverarbeitung", msg);
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
      const result = await importPdf(userId, fileName, fileBase64);
      setCards(result.cards);
      setModel(result.model);
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
      if (isApiError(error) && (error.code === "INSUFFICIENT_LP" || error.status === 402)) {
        setLpModalFeature("pdfImport");
        setLpModalCost(lpCostPdfImport);
        setLpModalVisible(true);
        return;
      }
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler beim PDF-Import", msg);
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
      const result = await scanText(userId, editedText);
      setCards(result.cards);
      setModel(result.model);
      setDeckTitle(result.deckTitle ?? "");
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostAiScan);
      }
    } catch (error: unknown) {
      if (isApiError(error) && (error.code === "INSUFFICIENT_LP" || error.status === 402)) {
        setLpModalFeature("aiScan");
        setLpModalCost(lpCostAiScan);
        setLpModalVisible(true);
        return;
      }
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler", msg);
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
      const result = await importFromUrl(userId, normalizedUrl, 4);
      setCards(result.cards);
      setModel(result.model);
      setDeckTitle(result.deckTitle ?? "");
      if (result.usage) {
        deductLp(result.usage.lpSpent);
        setUsage({ lpBalance: result.usage.lpBalance });
      } else {
        deductLp(lpCostUrlImport);
      }
    } catch (error: unknown) {
      if (isApiError(error) && (error.code === "INSUFFICIENT_LP" || error.status === 402)) {
        setLpModalFeature("urlImport");
        setLpModalCost(lpCostUrlImport);
        setLpModalVisible(true);
        return;
      }
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler beim URL-Import", msg);
    } finally {
      setLoading(false);
    }
  };

  const saveCardsToDeck = async (deckId: string, title: string) => {
    if (!userId || cards.length === 0) return;
    setSaving(true);
    try {
      const savedCards = [];
      for (const card of cards) {
        const { card: savedCard } = await createCard(userId, deckId, card);
        savedCards.push(savedCard);
      }

      setSaved(true);
      startReview(
        savedCards.map((c) => ({ id: c.id, front: c.front, back: c.back }))
      );

      Alert.alert(
        "Gespeichert!",
        `${savedCards.length} Karten in "${title}" gespeichert.`,
        [
          {
            text: "Jetzt lernen",
            onPress: () => router.push("/(tabs)/learn"),
          },
        ]
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler beim Speichern", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewDeck = async () => {
    if (!userId || cards.length === 0) return;
    setSaving(true);
    try {
      const title =
        deckTitle || `Scan ${new Date().toLocaleDateString("de")}`;
      const { deck } = await createDeck(userId, title, ["scan", "auto"]);
      await saveCardsToDeck(deck.id, deck.title);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler beim Speichern", msg);
      setSaving(false);
    }
  };

  const handleSaveToExistingDeck = async () => {
    if (!userId) return;
    try {
      const { decks: existingDecks } = await listDecks(userId);
      if (existingDecks.length === 0) {
        Alert.alert(
          "Keine Decks",
          "Du hast noch keine Decks. Es wird ein neues erstellt.",
          [{ text: "OK", onPress: handleSaveNewDeck }]
        );
        return;
      }
      const buttons = existingDecks.slice(0, 8).map((d: Deck) => ({
        text: d.title,
        onPress: () => saveCardsToDeck(d.id, d.title),
      }));
      buttons.push({ text: "Abbrechen", onPress: async () => {} });
      Alert.alert("Deck wählen", `${cards.length} Karten hinzufügen zu:`, buttons);
    } catch {
      Alert.alert("Fehler", "Decks konnten nicht geladen werden.");
    }
  };

  const handleSaveAndLearn = () => {
    if (!userId || cards.length === 0) return;
    Alert.alert("Karten speichern", `${cards.length} Karten speichern in:`, [
      { text: "Neues Deck", onPress: handleSaveNewDeck },
      { text: "Bestehendes Deck", onPress: handleSaveToExistingDeck },
      { text: "Abbrechen", style: "cancel" },
    ]);
  };

  const resetAll = () => {
    setCards([]);
    setModel("");
    setDeckTitle("");
    setSaved(false);
    setImageUri(null);
    setImageBase64(null);
    setMode("choose");
    setEditedText("");
    setSourceUrl("");
    setPdfFileName("");
    setPdfPageCount(null);
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
                    {lpCostAiScan}
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
                    {lpCostUrlImport}
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
            <Text style={{ color: colors.warning, fontSize: typography.xs, fontWeight: typography.semibold }}>
              {t("lp.earnMore")} →
            </Text>
          </TouchableOpacity>
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
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                }}
              >
                {cards.length} Karten generiert
              </Text>
              <Text
                style={{ fontSize: typography.xs, color: colors.textTertiary }}
              >
                via {model}
              </Text>
            </View>

            {cards.map((card, idx) => {
              const media = summarizeCardMedia(card);
              const frontDisplay = (media.plainFront || card.front).replace(
                /\{\{c\d+::(.+?)\}\}/g,
                "[$1]"
              );
              const backDisplay = media.plainBack || card.back;
              return (
                <View
                  key={idx}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {media.primaryImage ? (
                    <Image
                      source={{ uri: media.primaryImage.url }}
                      style={{
                        width: "100%",
                        height: 160,
                        borderRadius: radius.md,
                        marginBottom: spacing.sm,
                        backgroundColor: colors.surfaceSecondary,
                      }}
                      resizeMode="contain"
                    />
                  ) : null}
                  <Text
                    style={{
                      fontWeight: typography.semibold,
                      fontSize: typography.base,
                      marginBottom: spacing.sm,
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
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.sm,
                      marginTop: spacing.sm,
                    }}
                  >
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
                      {card.type}
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
                      {card.difficulty}
                    </Text>
                  </View>
                </View>
              );
            })}

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
              onPress={resetAll}
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
