import { useCallback, useEffect, useState, useRef } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  ImagePlus,
  Trash2,
  Check,
  Square,
  HelpCircle,
  Move,
} from "lucide-react-native";
import { useSessionStore } from "../src/store/sessionStore";
import { createDeck, createCard } from "../src/lib/api";
import { useColors, spacing, radius, typography, shadows } from "../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.8;

// Rectangle region on the image
interface Region {
  id: string;
  x: number; // percent (0-1)
  y: number; // percent (0-1)
  w: number; // percent
  h: number; // percent
  label: string;
}

export default function OcclusionScreen() {
  const colors = useColors();
  const { deckTitle } = useLocalSearchParams<{ deckTitle?: string }>();
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const imageRef = useRef<View>(null);
  const [imageLayout, setImageLayout] = useState({ x: 0, y: 0, w: SCREEN_WIDTH - spacing.lg * 2, h: IMAGE_HEIGHT });

  // Pick image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setRegions([]);
    }
  };

  // PanResponder for drawing rectangles on the image
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const touch = evt.nativeEvent;
      // Calculate position relative to image
      const x = (touch.locationX) / imageLayout.w;
      const y = (touch.locationY) / imageLayout.h;
      setStartPos({ x, y });
      setCurrentRect({ x, y, w: 0, h: 0 });
      setDrawing(true);
    },
    onPanResponderMove: (evt) => {
      if (!startPos) return;
      const touch = evt.nativeEvent;
      const endX = (touch.locationX) / imageLayout.w;
      const endY = (touch.locationY) / imageLayout.h;
      const rx = Math.min(startPos.x, endX);
      const ry = Math.min(startPos.y, endY);
      const rw = Math.abs(endX - startPos.x);
      const rh = Math.abs(endY - startPos.y);
      setCurrentRect({ x: rx, y: ry, w: rw, h: rh });
    },
    onPanResponderRelease: () => {
      setDrawing(false);
      if (currentRect && currentRect.w > 0.03 && currentRect.h > 0.03) {
        // Minimum size check (3% of image)
        const newRegion: Region = {
          id: `r-${Date.now()}`,
          ...currentRect,
          label: `Bereich ${regions.length + 1}`,
        };
        setRegions((prev) => [...prev, newRegion]);
      }
      setStartPos(null);
      setCurrentRect(null);
    },
  });

  const removeRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  };

  const renameRegion = (id: string) => {
    const region = regions.find((r) => r.id === id);
    if (!region) return;
    Alert.prompt(
      "Bereich benennen",
      "Gib eine Bezeichnung für diesen Bereich ein:",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "OK",
          onPress: (text?: string) => {
            if (text?.trim()) {
              setRegions((prev) =>
                prev.map((r) =>
                  r.id === id ? { ...r, label: text.trim() } : r
                )
              );
            }
          },
        },
      ],
      "plain-text",
      region.label
    );
  };

  // Save as deck with cards
  const handleSave = async () => {
    if (!userId || !imageUri || regions.length === 0) return;
    setSaving(true);
    try {
      const title = deckTitle || `Image Occlusion ${new Date().toLocaleDateString("de-DE")}`;
      const { deck } = await createDeck(userId, title, ["occlusion"]);

      // Create one card per region
      for (const region of regions) {
        // Front: image description with occluded area
        // Back: the label of the region
        await createCard(userId, deck.id, {
          front: `[Bild-Occlusion] Was verbirgt sich bei "${region.label}"?`,
          back: region.label,
          type: "basic",
          difficulty: "medium",
          tags: ["occlusion"],
        });
      }

      Alert.alert(
        "Gespeichert!",
        `${regions.length} Karte${regions.length !== 1 ? "n" : ""} erstellt.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Fehler", "Karten konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Image Occlusion",
          headerBackTitle: "Zurück",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.lg,
            gap: spacing.lg,
          }}
        >
          {/* Instructions */}
          {!imageUri && (
            <View
              style={{
                alignItems: "center",
                paddingVertical: spacing.xxxl,
                gap: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primaryLight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ImagePlus size={36} color={colors.primary} />
              </View>
              <Text
                style={{
                  fontSize: typography.lg,
                  fontWeight: typography.semibold,
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                Image Occlusion
              </Text>
              <Text
                style={{
                  fontSize: typography.base,
                  color: colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 22,
                  paddingHorizontal: spacing.xl,
                }}
              >
                Wähle ein Bild und markiere Bereiche, die beim Lernen verdeckt werden sollen.
                Pro markiertem Bereich wird eine Lernkarte erstellt.
              </Text>
              <TouchableOpacity
                onPress={pickImage}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.xxl,
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  flexDirection: "row",
                  gap: spacing.sm,
                  alignItems: "center",
                }}
              >
                <ImagePlus size={18} color={colors.textInverse} />
                <Text
                  style={{
                    color: colors.textInverse,
                    fontWeight: typography.bold,
                    fontSize: typography.base,
                  }}
                >
                  Bild auswählen
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Image with regions overlay */}
          {imageUri && (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    fontWeight: typography.medium,
                  }}
                >
                  Zeichne Rechtecke auf dem Bild
                </Text>
                <TouchableOpacity onPress={pickImage}>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      color: colors.primary,
                      fontWeight: typography.semibold,
                    }}
                  >
                    Bild ändern
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Image canvas */}
              <View
                ref={imageRef}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setImageLayout((prev) => ({ ...prev, w: width, h: height }));
                }}
                style={{
                  width: "100%",
                  height: IMAGE_HEIGHT,
                  borderRadius: radius.lg,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: drawing ? colors.primary : colors.border,
                  position: "relative",
                }}
                {...panResponder.panHandlers}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />

                {/* Existing regions */}
                {regions.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => renameRegion(r.id)}
                    onLongPress={() => removeRegion(r.id)}
                    activeOpacity={0.8}
                    style={{
                      position: "absolute",
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      backgroundColor: colors.primary + "40",
                      borderWidth: 2,
                      borderColor: colors.primary,
                      borderRadius: radius.sm,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: typography.xs,
                        color: colors.textInverse,
                        fontWeight: typography.bold,
                        backgroundColor: colors.primary + "CC",
                        paddingHorizontal: spacing.xs,
                        paddingVertical: 1,
                        borderRadius: 4,
                      }}
                      numberOfLines={1}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Currently drawing rectangle */}
                {currentRect && (
                  <View
                    style={{
                      position: "absolute",
                      left: `${currentRect.x * 100}%`,
                      top: `${currentRect.y * 100}%`,
                      width: `${currentRect.w * 100}%`,
                      height: `${currentRect.h * 100}%`,
                      backgroundColor: colors.accent + "30",
                      borderWidth: 2,
                      borderColor: colors.accent,
                      borderStyle: "dashed",
                      borderRadius: radius.sm,
                    }}
                  />
                )}
              </View>

              {/* Hint */}
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <Move size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: typography.xs, color: colors.textTertiary, flex: 1 }}>
                  Ziehe Rechtecke auf das Bild. Tippe zum Umbenennen, halte gedrückt zum Löschen.
                </Text>
              </View>

              {/* Region list */}
              {regions.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <Text
                    style={{
                      fontSize: typography.sm,
                      fontWeight: typography.semibold,
                      color: colors.textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {regions.length} Bereich{regions.length !== 1 ? "e" : ""} markiert
                  </Text>
                  {regions.map((r, i) => (
                    <View
                      key={r.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: colors.surface,
                        padding: spacing.md,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        gap: spacing.md,
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: colors.primaryLight,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: typography.sm,
                            fontWeight: typography.bold,
                            color: colors.primary,
                          }}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => renameRegion(r.id)}
                      >
                        <Text
                          style={{
                            fontSize: typography.base,
                            color: colors.text,
                            fontWeight: typography.medium,
                          }}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeRegion(r.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Save button */}
              {regions.length > 0 && (
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.sm,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Check size={18} color={colors.textInverse} />
                  )}
                  <Text
                    style={{
                      color: colors.textInverse,
                      fontSize: typography.lg,
                      fontWeight: typography.bold,
                    }}
                  >
                    {saving
                      ? "Speichern..."
                      : `${regions.length} Karte${regions.length !== 1 ? "n" : ""} erstellen`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
