import { useState, useRef } from "react";
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
import {
  Camera,
  ImageIcon,
  PenLine,
  Lightbulb,
  Save,
  RotateCcw,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react-native";
import { useSessionStore } from "../../src/store/sessionStore";
import { useOcrEditorState } from "../../src/features/ocr/ocrEditorState";
import {
  isApiError,
  scanText,
  scanImage,
  createDeck,
  createCard,
  listDecks,
  type Flashcard,
  type Deck,
} from "../../src/lib/api";
import { useReviewSession } from "../../src/features/review/reviewSession";
import { useColors, spacing, radius, typography, shadows } from "../../src/theme";

type InputMode = "choose" | "camera" | "text";

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const editedText = useOcrEditorState((state) => state.editedText);
  const setOriginalText = useOcrEditorState((state) => state.setOriginalText);
  const setEditedText = useOcrEditorState((state) => state.setEditedText);
  const startReview = useReviewSession((state) => state.start);

  const [mode, setMode] = useState<InputMode>("choose");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [model, setModel] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const colors = useColors();

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

  const processImage = async (
    base64: string,
    mimeType: "image/jpeg" | "image/png" | "image/webp"
  ) => {
    if (!userId) return;
    setLoading(true);
    setCards([]);
    setSaved(false);
    try {
      const result = await scanImage(userId, base64, mimeType);
      setCards(result.cards);
      setModel(result.model);
      setDeckTitle(result.deckTitle ?? "");
    } catch (error: unknown) {
      if (
        isApiError(error) &&
        (error.code === "PAYWALL_REQUIRED" || error.status === 402)
      ) {
        router.push("/paywall");
        return;
      }
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler bei der Bildverarbeitung", msg);
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
    try {
      const result = await scanText(userId, editedText);
      setCards(result.cards);
      setModel(result.model);
      setDeckTitle(result.deckTitle ?? "");
    } catch (error: unknown) {
      if (
        isApiError(error) &&
        (error.code === "PAYWALL_REQUIRED" || error.status === 402)
      ) {
        router.push("/paywall");
        return;
      }
      const msg =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler", msg);
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
              <X size={18} color="#fff" />
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
              <X size={16} color={colors.primary} />
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
                <Text
                  style={{
                    color: colors.textInverse,
                    fontSize: typography.lg,
                    fontWeight: typography.bold,
                  }}
                >
                  Flashcards generieren
                </Text>
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
        <Text
          style={{
            fontSize: typography.xxl,
            fontWeight: typography.bold,
            color: colors.text,
          }}
        >
          {cards.length > 0 ? "Ergebnis" : "Lernmaterial erfassen"}
        </Text>

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
                  : "Flashcards werden generiert..."}
            </Text>
            <Text
              style={{ fontSize: typography.sm, color: colors.textSecondary }}
            >
              {saving
                ? `${cards.length} Karten werden in deinem Deck gespeichert`
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
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: typography.sm,
                    marginTop: 2,
                  }}
                >
                  Lehrbuch, Tafel, Notizen fotografieren
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
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: typography.sm,
                    marginTop: 2,
                  }}
                >
                  Vorhandenes Foto oder Screenshot
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
                <Text
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: typography.sm,
                    marginTop: 2,
                  }}
                >
                  Text tippen oder einfügen
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
                Flashcards — aus Fotos, Screenshots oder Text.
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
              const frontDisplay = card.front.replace(
                /\{\{c\d+::(.+?)\}\}/g,
                "[$1]"
              );
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
                  <Text
                    style={{
                      fontWeight: typography.semibold,
                      fontSize: typography.base,
                      marginBottom: spacing.sm,
                      color: colors.text,
                    }}
                  >
                    {frontDisplay}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: typography.sm + 1,
                    }}
                  >
                    {card.back}
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
