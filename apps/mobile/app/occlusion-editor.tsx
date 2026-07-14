import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, Trash2, Check, AlertTriangle } from "lucide-react-native";
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
import {
  type CanvasTransform,
  screenToImageNorm,
  pinchTransform,
  fitViewport,
} from "../src/lib/occlusionCanvas";
import { uploadOcclusionImage, removeCardImage } from "../src/lib/occlusionStorage";
import { createCard, deleteCard, isApiError } from "../src/lib/api";

type PickedImage = { uri: string; base64: string; width: number; height: number; mime: string };
type Point = { nx: number; ny: number };

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
  const { width: winW, height: winH } = useWindowDimensions();
  const userId = useSessionStore((s) => s.userId);
  const { deckId, deckTitle } = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();

  const [image, setImage] = useState<PickedImage | null>(null);
  const [regions, setRegions] = useState<OcclusionRegion[]>([]);
  const [transform, setTransform] = useState<CanvasTransform>({ zoom: 1, panX: 0, panY: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fit the image into a fixed box → the viewport matches the image aspect, so
  // at zoom 1 the image fills it with no letterbox and coordinates map cleanly.
  const viewport = useMemo(
    () =>
      image
        ? fitViewport(image.width, image.height, winW - spacing.lg * 2, winH * 0.45)
        : { vw: 0, vh: 0 },
    [image, winW, winH],
  );

  // Mirrors of state read synchronously inside gesture callbacks.
  const vpRef = useRef(viewport);
  const transformRef = useRef(transform);
  const drawStartRef = useRef<Point | null>(null);
  const drawCurrRef = useRef<Point | null>(null);
  const pinchRef = useRef<{ startZoom: number; anchor: Point }>({ startZoom: 1, anchor: { nx: 0, ny: 0 } });

  useEffect(() => {
    vpRef.current = viewport;
  }, [viewport]);

  function setT(t: CanvasTransform) {
    transformRef.current = t;
    setTransform(t);
  }

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
    setDrawRect(null);
    setT({ zoom: 1, panX: 0, panY: 0 });
    setError(null);
  }

  // ── Gestures: one finger draws, two fingers zoom/move ──────────────────────
  const drawGesture = Gesture.Pan()
    .maxPointers(1)
    .runOnJS(true)
    .onBegin((e) => {
      const vp = vpRef.current;
      if (!vp.vw) return;
      const n = screenToImageNorm(e.x, e.y, transformRef.current, vp);
      drawStartRef.current = n;
      drawCurrRef.current = n;
      setDrawRect({ x: n.nx, y: n.ny, w: 0, h: 0 });
    })
    .onUpdate((e) => {
      const s = drawStartRef.current;
      if (!s) return;
      const n = screenToImageNorm(e.x, e.y, transformRef.current, vpRef.current);
      drawCurrRef.current = n;
      setDrawRect(normalizeDragRect(s.nx, s.ny, n.nx, n.ny));
    })
    .onEnd(() => {
      const s = drawStartRef.current;
      const c = drawCurrRef.current;
      if (s && c) {
        const rect = normalizeDragRect(s.nx, s.ny, c.nx, c.ny);
        if (isRegionLargeEnough(rect.w, rect.h)) {
          setRegions((prev) => [...prev, { ...rect, label: `Bereich ${prev.length + 1}` }]);
        }
      }
      drawStartRef.current = null;
      drawCurrRef.current = null;
      setDrawRect(null);
    })
    .onFinalize(() => {
      // Safety net for a cancelled draw (e.g. a second finger started a pinch).
      if (drawStartRef.current) {
        drawStartRef.current = null;
        drawCurrRef.current = null;
        setDrawRect(null);
      }
    });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onBegin((e) => {
      pinchRef.current = {
        startZoom: transformRef.current.zoom,
        anchor: screenToImageNorm(e.focalX, e.focalY, transformRef.current, vpRef.current),
      };
    })
    .onUpdate((e) => {
      setT(
        pinchTransform(
          pinchRef.current.startZoom,
          e.scale,
          e.focalX,
          e.focalY,
          pinchRef.current.anchor,
          vpRef.current,
        ),
      );
    });

  const gesture = Gesture.Simultaneous(pinchGesture, drawGesture);

  function resetZoom() {
    setT({ zoom: 1, panX: 0, panY: 0 });
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

  const canSave = !!image && regions.length > 0 && !!deckId && !saving;
  const pct = (n: number) => `${n * 100}%` as const;

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
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
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
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.md }}
            >
              <ImagePlus size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: typography.medium, fontSize: typography.base }}>
                {image ? "Anderes Bild" : "Galerie"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={takePhoto}
              activeOpacity={0.8}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.md }}
            >
              <Camera size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: typography.medium, fontSize: typography.base }}>Kamera</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!image ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl }}>
            <ImagePlus size={30} color={colors.textTertiary} />
            <Text style={{ color: colors.textSecondary, fontSize: typography.sm, textAlign: "center" }}>
              Wähle ein Bild (Diagramm, Skizze, Landkarte …), um zu starten.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ alignItems: "center", paddingTop: spacing.md }}>
              <GestureDetector gesture={gesture}>
                <View
                  style={{
                    width: viewport.vw,
                    height: viewport.vh,
                    overflow: "hidden",
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                >
                  <View
                    style={{
                      width: viewport.vw,
                      height: viewport.vh,
                      transform: [{ translateX: transform.panX }, { translateY: transform.panY }],
                    }}
                  >
                    <View
                      style={{
                        width: viewport.vw,
                        height: viewport.vh,
                        transformOrigin: "0% 0%",
                        transform: [{ scale: transform.zoom }],
                      }}
                    >
                      <Image source={{ uri: image.uri }} style={{ width: viewport.vw, height: viewport.vh }} resizeMode="cover" />
                      {regions.map((r, i) => (
                        <View
                          key={i}
                          style={{ position: "absolute", left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h), borderWidth: 2, borderColor: colors.success, backgroundColor: "rgba(16,185,129,0.18)", borderRadius: 3, alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ color: colors.success, fontSize: typography.xs, fontWeight: typography.semibold }}>{i + 1}</Text>
                        </View>
                      ))}
                      {drawRect && (
                        <View
                          style={{ position: "absolute", left: pct(drawRect.x), top: pct(drawRect.y), width: pct(drawRect.w), height: pct(drawRect.h), borderWidth: 2, borderColor: colors.primary, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 3 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              </GestureDetector>
              {transform.zoom > 1.01 && (
                <TouchableOpacity
                  onPress={resetZoom}
                  style={{ position: "absolute", top: spacing.md + spacing.sm, right: spacing.lg + spacing.sm, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full }}
                >
                  <Text style={{ color: "#fff", fontSize: typography.xs, fontWeight: typography.semibold }}>Zoom 1:1</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={{ color: colors.textTertiary, fontSize: typography.xs, textAlign: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
              {regions.length > 0
                ? `${regions.length} ${regions.length === 1 ? "Bereich" : "Bereiche"} — 1 Finger zeichnen, 2 Finger zoomen`
                : "1 Finger: Kästchen ziehen · 2 Finger: zoomen & verschieben"}
            </Text>

            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
              {regions.map((r, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.success, fontSize: typography.xs, fontWeight: typography.semibold }}>{i + 1}</Text>
                  </View>
                  <TextInput
                    value={r.label}
                    onChangeText={(t) => setLabel(i, t)}
                    placeholder="Beschriftung"
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: typography.base, backgroundColor: colors.surface }}
                  />
                  <TouchableOpacity onPress={() => removeRegion(i)} accessibilityLabel="Bereich entfernen" hitSlop={8}>
                    <Trash2 size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}

              {error && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.errorLight, borderRadius: radius.md, padding: spacing.md }}>
                  <AlertTriangle size={16} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: typography.sm, flex: 1 }}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={save}
                disabled={!canSave}
                activeOpacity={0.85}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: canSave ? colors.primary : colors.surfaceSecondary, paddingVertical: spacing.lg, borderRadius: radius.md, marginTop: spacing.sm }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <>
                    <Check size={18} color={canSave ? "#ffffff" : colors.textTertiary} />
                    <Text style={{ color: canSave ? "#ffffff" : colors.textTertiary, fontWeight: typography.semibold, fontSize: typography.base }}>
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
          </>
        )}
      </SafeAreaView>
    </>
  );
}
