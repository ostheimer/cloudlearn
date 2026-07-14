import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Trash2, X, Check, AlertTriangle } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";
import {
  type OcclusionRegion,
  extForMime,
  occlusionImagePath,
  buildOcclusionCardInputs,
  normalizeDragRect,
  isRegionLargeEnough,
} from "../src/lib/occlusion";
import { uploadOcclusionImage, removeCardImage } from "../src/lib/occlusionStorage";
import { createCard, deleteCard, isApiError } from "../src/lib/api";

type PickedImage = { uri: string; base64: string; width: number; height: number; mime: string };
type DrawBox = { sx: number; sy: number; x: number; y: number };

function mimeFromUri(uri: string): string {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export default function OcclusionEditorScreen() {
  const colors = useColors();
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);
  const { deckId, deckTitle } = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();

  const [image, setImage] = useState<PickedImage | null>(null);
  const [regions, setRegions] = useState<OcclusionRegion[]>([]);
  const [draw, setDraw] = useState<DrawBox | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const drawRef = useRef<DrawBox | null>(null);

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    applyPick(result);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Kamera-Zugriff wurde nicht erlaubt.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    applyPick(result);
  }

  function applyPick(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError("Bild konnte nicht gelesen werden.");
      return;
    }
    setImage({
      uri: asset.uri,
      base64: asset.base64,
      width: asset.width || 1,
      height: asset.height || 1,
      mime: asset.mimeType ?? mimeFromUri(asset.uri),
    });
    setRegions([]);
    setDraw(null);
    setError(null);
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { w, h } = stageSizeRef.current;
          if (!w || !h) return;
          const x = e.nativeEvent.locationX / w;
          const y = e.nativeEvent.locationY / h;
          drawRef.current = { sx: x, sy: y, x, y };
          setDraw(drawRef.current);
        },
        onPanResponderMove: (e) => {
          const { w, h } = stageSizeRef.current;
          if (!w || !h || !drawRef.current) return;
          const next = {
            ...drawRef.current,
            x: e.nativeEvent.locationX / w,
            y: e.nativeEvent.locationY / h,
          };
          drawRef.current = next;
          setDraw(next);
        },
        onPanResponderRelease: () => {
          const d = drawRef.current;
          drawRef.current = null;
          setDraw(null);
          if (!d) return;
          const rect = normalizeDragRect(d.sx, d.sy, d.x, d.y);
          if (!isRegionLargeEnough(rect.w, rect.h)) return;
          setRegions((prev) => [...prev, { ...rect, label: `Bereich ${prev.length + 1}` }]);
        },
      }),
    [],
  );

  function onStageLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    stageSizeRef.current = { w: width, h: height };
  }

  function removeRegion(i: number) {
    setRegions((prev) => prev.filter((_, j) => j !== i));
  }
  function setLabel(i: number, label: string) {
    setRegions((prev) => prev.map((r, j) => (j === i ? { ...r, label } : r)));
  }

  async function save() {
    if (!userId || !deckId || !image || regions.length === 0 || saving) return;
    setSaving(true);
    setError(null);

    const ext = extForMime(image.mime);
    const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const path = occlusionImagePath(userId, deckId, uniqueId, ext);
    const inputs = buildOcclusionCardInputs(path, regions);
    const createdIds: string[] = [];

    try {
      await uploadOcclusionImage(image.base64, image.mime, path);
      for (const input of inputs) {
        const { card } = await createCard(userId, deckId, input);
        createdIds.push(card.id);
      }
      router.back();
    } catch (e) {
      if (createdIds.length > 0) {
        await Promise.allSettled(createdIds.map((id) => deleteCard(id)));
      }
      await removeCardImage(path).catch(() => {});
      setError(
        isApiError(e) ? e.message : e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
      );
      setSaving(false);
    }
  }

  const drawBox = draw ? normalizeDragRect(draw.sx, draw.sy, draw.x, draw.y) : null;
  const canSave = !!image && regions.length > 0 && !!deckId && !saving;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Bild-Abdecken",
          headerBackTitle: "Zurück",
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: colors.successLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImagePlus size={24} color={colors.success} />
            </View>
            <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text }}>
              Occlusion-Karten
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center" }}>
              {deckTitle ? `Deck: ${deckTitle}` : "Bild wählen, Kästchen ziehen, beschriften"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity
              onPress={pickFromGallery}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                backgroundColor: colors.surfaceSecondary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
              }}
            >
              <ImagePlus size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: typography.medium, fontSize: typography.base }}>
                {image ? "Anderes Bild" : "Galerie"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={takePhoto}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                backgroundColor: colors.surfaceSecondary,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
              }}
            >
              <Camera size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: typography.medium, fontSize: typography.base }}>
                Kamera
              </Text>
            </TouchableOpacity>
          </View>

          {!image ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                paddingVertical: spacing.xxxl,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
                borderRadius: radius.md,
              }}
            >
              <ImagePlus size={30} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: typography.sm, textAlign: "center", paddingHorizontal: spacing.lg }}>
                Wähle ein Bild (Diagramm, Skizze, Landkarte …), um zu starten.
              </Text>
            </View>
          ) : (
            <>
              <View
                {...panResponder.panHandlers}
                onLayout={onStageLayout}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: image.width / image.height,
                  borderRadius: radius.md,
                  overflow: "hidden",
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <Image source={{ uri: image.uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                {regions.map((r, i) => (
                  <View
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      borderWidth: 2,
                      borderColor: colors.success,
                      backgroundColor: "rgba(16,185,129,0.18)",
                      borderRadius: 4,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.success, fontSize: typography.xs, fontWeight: typography.semibold }}>
                      {i + 1}
                    </Text>
                  </View>
                ))}
                {drawBox && (
                  <View
                    style={{
                      position: "absolute",
                      left: `${drawBox.x * 100}%`,
                      top: `${drawBox.y * 100}%`,
                      width: `${drawBox.w * 100}%`,
                      height: `${drawBox.h * 100}%`,
                      borderWidth: 2,
                      borderColor: colors.primary,
                      backgroundColor: "rgba(99,102,241,0.15)",
                      borderRadius: 4,
                    }}
                  />
                )}
              </View>

              <Text style={{ color: colors.textTertiary, fontSize: typography.xs, textAlign: "center" }}>
                {regions.length > 0
                  ? `${regions.length} ${regions.length === 1 ? "Bereich" : "Bereiche"} markiert — beschrifte sie unten.`
                  : "Ziehe mit dem Finger ein Kästchen über einen Bildteil."}
              </Text>

              {regions.map((r, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.successLight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.success, fontSize: typography.xs, fontWeight: typography.semibold }}>
                      {i + 1}
                    </Text>
                  </View>
                  <TextInput
                    value={r.label}
                    onChangeText={(t) => setLabel(i, t)}
                    placeholder="Beschriftung"
                    placeholderTextColor={colors.textTertiary}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      color: colors.text,
                      fontSize: typography.base,
                      backgroundColor: colors.surface,
                    }}
                  />
                  <TouchableOpacity onPress={() => removeRegion(i)} accessibilityLabel="Bereich entfernen" hitSlop={8}>
                    <Trash2 size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {error && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: colors.errorLight,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <AlertTriangle size={16} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: typography.sm, flex: 1 }}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={save}
            disabled={!canSave}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
              backgroundColor: canSave ? colors.primary : colors.surfaceSecondary,
              paddingVertical: spacing.lg,
              borderRadius: radius.md,
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Check size={18} color={canSave ? "#ffffff" : colors.textTertiary} />
                <Text
                  style={{
                    color: canSave ? "#ffffff" : colors.textTertiary,
                    fontWeight: typography.semibold,
                    fontSize: typography.base,
                  }}
                >
                  {regions.length > 0
                    ? `${regions.length} Occlusion-${regions.length === 1 ? "Karte" : "Karten"} erstellen`
                    : "Occlusion-Karten erstellen"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {!deckId && (
            <Text style={{ color: colors.textTertiary, fontSize: typography.xs, textAlign: "center" }}>
              Öffne den Editor aus einem Deck, um Karten zu speichern.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
