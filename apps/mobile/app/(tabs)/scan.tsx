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
import { useSessionStore } from "../../src/store/sessionStore";
import { useOcrEditorState } from "../../src/features/ocr/ocrEditorState";
import {
  scanText,
  scanImage,
  createDeck,
  createCard,
  type Flashcard,
} from "../../src/lib/api";
import { useReviewSession } from "../../src/features/review/reviewSession";

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
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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

  const getMimeType = (uri: string): "image/jpeg" | "image/png" | "image/webp" => {
    if (uri.toLowerCase().endsWith(".png")) return "image/png";
    if (uri.toLowerCase().endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  };

  const processImage = async (base64: string, mimeType: "image/jpeg" | "image/png" | "image/webp") => {
    if (!userId) return;
    setLoading(true);
    setCards([]);
    setSaved(false);
    try {
      const result = await scanImage(userId, base64, mimeType);
      setCards(result.cards);
      setModel(result.model);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndLearn = async () => {
    if (!userId || cards.length === 0) return;
    setLoading(true);
    try {
      const { deck } = await createDeck(userId, `Scan ${new Date().toLocaleDateString("de")}`, [
        "scan",
        "auto",
      ]);

      const savedCards = [];
      for (const card of cards) {
        const { card: savedCard } = await createCard(userId, deck.id, card);
        savedCards.push(savedCard);
      }

      setSaved(true);
      startReview(
        savedCards.map((c) => ({ id: c.id, front: c.front, back: c.back }))
      );

      Alert.alert(
        "Gespeichert!",
        `${savedCards.length} Karten in "${deck.title}" gespeichert.`,
        [{ text: "Jetzt lernen", onPress: () => router.push("/(tabs)/learn") }]
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      Alert.alert("Fehler beim Speichern", msg);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setCards([]);
    setModel("");
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
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
        >
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
                backgroundColor: "#fff",
                borderWidth: 4,
                borderColor: "#d1d5db",
                marginBottom: 16,
              }}
            />
            {/* Back button */}
            <TouchableOpacity onPress={() => setMode("choose")}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "700" }}>Text eingeben</Text>
            <TouchableOpacity onPress={() => setMode("choose")}>
              <Text style={{ color: "#6366f1", fontSize: 16, fontWeight: "600" }}>Zurück</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            multiline
            value={editedText}
            onChangeText={setEditedText}
            placeholder="Tippe oder füge hier deinen Lerntext ein..."
            placeholderTextColor="#9ca3af"
            style={{
              minHeight: 180,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              backgroundColor: "#fff",
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
                backgroundColor: "#e5e7eb",
                borderRadius: 10,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#374151", fontWeight: "500" }}>Beispieltext laden</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleGenerateFromText}
            disabled={loading || !editedText.trim()}
            style={{
              backgroundColor: loading || !editedText.trim() ? "#9ca3af" : "#6366f1",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                Flashcards generieren
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Main Choose Mode + Results View ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>
          {cards.length > 0 ? "Ergebnis" : "Lernmaterial erfassen"}
        </Text>

        {/* Loading overlay */}
        {loading && (
          <View
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 16,
              padding: 32,
              alignItems: "center",
              gap: 12,
            }}
          >
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={{ fontSize: 16, color: "#374151", fontWeight: "600" }}>
              {imageUri ? "Bild wird analysiert..." : "Flashcards werden generiert..."}
            </Text>
            <Text style={{ fontSize: 13, color: "#6b7280" }}>
              Gemini AI verarbeitet dein Material
            </Text>
          </View>
        )}

        {/* Input mode buttons (only when no results and not loading) */}
        {cards.length === 0 && !loading && (
          <View style={{ gap: 12 }}>
            {/* Captured image preview */}
            {imageUri && (
              <View style={{ alignItems: "center", marginBottom: 8 }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: "100%", height: 200, borderRadius: 12 }}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Camera button */}
            <TouchableOpacity
              onPress={openCamera}
              style={{
                backgroundColor: "#6366f1",
                borderRadius: 16,
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 32 }}>📸</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                  Foto aufnehmen
                </Text>
                <Text style={{ color: "#c7d2fe", fontSize: 13, marginTop: 2 }}>
                  Lehrbuch, Tafel, Notizen fotografieren
                </Text>
              </View>
            </TouchableOpacity>

            {/* Gallery button */}
            <TouchableOpacity
              onPress={handlePickFromGallery}
              style={{
                backgroundColor: "#059669",
                borderRadius: 16,
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 32 }}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                  Aus Galerie wählen
                </Text>
                <Text style={{ color: "#a7f3d0", fontSize: 13, marginTop: 2 }}>
                  Vorhandenes Foto oder Screenshot
                </Text>
              </View>
            </TouchableOpacity>

            {/* Text input button */}
            <TouchableOpacity
              onPress={() => setMode("text")}
              style={{
                backgroundColor: "#f59e0b",
                borderRadius: 16,
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Text style={{ fontSize: 32 }}>✏️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                  Text eingeben
                </Text>
                <Text style={{ color: "#fef3c7", fontSize: 13, marginTop: 2 }}>
                  Text tippen oder einfügen
                </Text>
              </View>
            </TouchableOpacity>

            {/* Info text */}
            <View
              style={{
                backgroundColor: "#eff6ff",
                borderRadius: 12,
                padding: 14,
                marginTop: 4,
              }}
            >
              <Text style={{ color: "#1e40af", fontSize: 13, lineHeight: 20 }}>
                💡 Gemini AI analysiert dein Material und erstellt automatisch Flashcards — aus Fotos, Screenshots oder Text.
              </Text>
            </View>
          </View>
        )}

        {/* Generated cards */}
        {cards.length > 0 && !loading && (
          <View style={{ gap: 12 }}>
            {/* Image preview if from photo */}
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: 120, borderRadius: 12 }}
                resizeMode="cover"
              />
            )}

            <Text style={{ fontSize: 16, fontWeight: "600", color: "#374151" }}>
              {cards.length} Karten generiert
            </Text>
            <Text style={{ fontSize: 13, color: "#6b7280", marginTop: -8 }}>
              via {model}
            </Text>

            {cards.map((card, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              >
                <Text style={{ fontWeight: "600", fontSize: 15, marginBottom: 6 }}>
                  {card.front}
                </Text>
                <Text style={{ color: "#4b5563", fontSize: 14 }}>{card.back}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      backgroundColor: "#f3f4f6",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      color: "#6b7280",
                    }}
                  >
                    {card.type}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      backgroundColor: "#f3f4f6",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      color: "#6b7280",
                    }}
                  >
                    {card.difficulty}
                  </Text>
                </View>
              </View>
            ))}

            {/* Save and learn */}
            {!saved && (
              <TouchableOpacity
                onPress={handleSaveAndLearn}
                disabled={loading}
                style={{
                  backgroundColor: "#059669",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                  Speichern & Lernen
                </Text>
              </TouchableOpacity>
            )}

            {/* New scan */}
            <TouchableOpacity
              onPress={resetAll}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                padding: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#374151", fontSize: 15, fontWeight: "600" }}>
                Neuen Scan starten
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
