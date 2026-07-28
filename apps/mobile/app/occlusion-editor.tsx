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
import * as ImageManipulator from "expo-image-manipulator";
import { Camera, ImagePlus, Trash2, Check, AlertTriangle, Sparkles } from "lucide-react-native";
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
import {
  uploadOcclusionImage,
  removeCardImage,
  getCardImageSignedUrl,
} from "../src/lib/occlusionStorage";
import { createCard, deleteCard, isApiError, getSubscriptionStatus } from "../src/lib/api";

type PickedImage = { uri: string; base64: string; width: number; height: number; mime: string };
type Point = { nx: number; ny: number };

// Ergebnis der Tarif-Abfrage beim Öffnen des Editors.
// "unknown" deckt beides ab: läuft noch UND fehlgeschlagen. Nur ein bestätigtes
// "free" sperrt — siehe proGateState unten.
type ProGateState = "unknown" | "free" | "pro";

// Longest side a picked image is scaled down to before display/upload. Keeps
// memory low and the file well under the 5 MB card-image storage limit (#207).
const MAX_IMAGE_DIM = 1600;

function safeParseRegions(json: string | undefined): OcclusionRegion[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as OcclusionRegion[]) : [];
  } catch {
    return [];
  }
}

function safeParseIds(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function OcclusionEditorScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width: winW, height: winH } = useWindowDimensions();
  const userId = useSessionStore((s) => s.userId);
  // editPath/editRegions/replaceCardIds are set when re-opening an existing
  // image to change its regions ("Bearbeiten"). editRegions and replaceCardIds
  // arrive as JSON strings.
  const { deckId, deckTitle, editPath, editRegions, replaceCardIds } = useLocalSearchParams<{
    deckId?: string;
    deckTitle?: string;
    editPath?: string;
    editRegions?: string;
    replaceCardIds?: string;
  }>();
  const isEditing = !!editPath;

  const [image, setImage] = useState<PickedImage | null>(null);
  const [regions, setRegions] = useState<OcclusionRegion[]>([]);
  const [transform, setTransform] = useState<CanvasTransform>({ zoom: 1, panX: 0, panY: 0 });
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Occlusion ist serverseitig eine Pro-Funktion (#352). Bisher merkte man das
  // erst beim Speichern — nach Bild wählen und allen Kästchen (#364). Darum
  // fragen wir den Tarif schon beim Öffnen ab.
  const [proGate, setProGate] = useState<ProGateState>("unknown");

  // When editing: the stored image path being reused (no re-upload) and the
  // card ids to delete once the new region set is saved.
  const existingPathRef = useRef<string | null>(null);
  const replaceCardIdsRef = useRef<string[]>([]);

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

  // Tarif beim Öffnen abfragen — BEWUSST fail-open: nur ein bestätigtes "free"
  // sperrt. Fehler, Netzproblem oder "läuft noch" bleiben "unknown" und lassen
  // den Editor ganz normal arbeiten. Jemanden auszusperren, der bezahlt hat,
  // wäre schlimmer als der bisherige Zustand — durchgesetzt wird die Sperre
  // ohnehin weiterhin serverseitig (402 beim Speichern), es entweicht nichts.
  // Absichtlich NICHT useUsageStore: dessen tier ist per Default "free" und
  // evtl. noch gar nicht geladen — das würde Pro-Nutzer fälschlich sperren.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSubscriptionStatus()
      .then((res) => {
        if (!cancelled) setProGate(res.status.tier === "free" ? "free" : "pro");
      })
      .catch(() => {
        if (!cancelled) setProGate("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Editing an existing image: load it from storage (signed URL) and pre-fill
  // its regions. base64 stays "" → save() reuses the stored image, no re-upload.
  useEffect(() => {
    if (!editPath) return;
    let cancelled = false;
    setProcessing(true);
    (async () => {
      try {
        const url = await getCardImageSignedUrl(editPath);
        if (!url) {
          if (!cancelled) setError("Bild konnte nicht geladen werden.");
          return;
        }
        const size = await new Promise<{ w: number; h: number }>((resolve) => {
          Image.getSize(url, (w, h) => resolve({ w, h }), () => resolve({ w: 1, h: 1 }));
        });
        if (cancelled) return;
        existingPathRef.current = editPath;
        replaceCardIdsRef.current = safeParseIds(replaceCardIds);
        setImage({ uri: url, base64: "", width: size.w || 1, height: size.h || 1, mime: "image/jpeg" });
        setRegions(safeParseRegions(editRegions));
      } catch {
        if (!cancelled) setError("Bild konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setProcessing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editPath, editRegions, replaceCardIds]);

  function setT(t: CanvasTransform) {
    transformRef.current = t;
    setTransform(t);
  }

  async function pickFromGallery() {
    // No base64 from the picker — a full-res photo's base64 is many MB in memory
    // and, together with a second one, crashed the app (#207). We downscale
    // first and take the (small) base64 from the resized copy instead.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    await applyPick(result);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Kamera-Zugriff wurde nicht erlaubt.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    await applyPick(result);
  }

  async function applyPick(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setError(null);
    setProcessing(true);
    try {
      // Downscale the long side to MAX_IMAGE_DIM and re-encode as JPEG. This
      // keeps memory low (no giant bitmap / base64) and stays well under the
      // 5 MB card-image storage limit. For occlusion the resolution is plenty.
      const longSide = Math.max(asset.width ?? 0, asset.height ?? 0);
      const actions: ImageManipulator.Action[] =
        longSide > MAX_IMAGE_DIM
          ? [
              {
                resize:
                  (asset.width ?? 0) >= (asset.height ?? 0)
                    ? { width: MAX_IMAGE_DIM }
                    : { height: MAX_IMAGE_DIM },
              },
            ]
          : [];
      const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (!out.base64) {
        setError("Bild konnte nicht verarbeitet werden.");
        return;
      }
      setImage({
        uri: out.uri,
        base64: out.base64,
        width: out.width || 1,
        height: out.height || 1,
        mime: "image/jpeg",
      });
      setRegions([]);
      setDrawRect(null);
      setT({ zoom: 1, panX: 0, panY: 0 });
    } catch {
      setError("Bild konnte nicht verarbeitet werden.");
    } finally {
      setProcessing(false);
    }
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

    // Reuse the stored image when editing and it wasn't swapped (base64 is ""),
    // otherwise upload the (new) picked image.
    const reuseExisting = image.base64 === "" && existingPathRef.current !== null;
    const oldPath = existingPathRef.current;
    const oldCardIds = replaceCardIdsRef.current;

    let path: string;
    let uploadedPath: string | null = null;
    if (reuseExisting) {
      path = oldPath as string;
    } else {
      const ext = extForMime(image.mime);
      const uniqueId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      path = occlusionImagePath(userId, deckId, uniqueId, ext);
    }

    const inputs = buildOcclusionCardInputs(path, regions);
    const createdIds: string[] = [];

    try {
      if (!reuseExisting) {
        await uploadOcclusionImage(image.base64, image.mime, path);
        uploadedPath = path;
      }
      // Create the new cards first, so a failure leaves the old ones untouched.
      for (const input of inputs) {
        const { card } = await createCard(userId, deckId, input);
        createdIds.push(card.id);
      }
      // Editing: remove the replaced cards, and the old image if it was swapped.
      if (oldCardIds.length > 0) {
        await Promise.allSettled(oldCardIds.map((id) => deleteCard(id)));
      }
      if (uploadedPath && oldPath && oldPath !== uploadedPath) {
        await removeCardImage(oldPath).catch(() => {});
      }
      router.back();
    } catch (e) {
      if (createdIds.length > 0) {
        await Promise.allSettled(createdIds.map((id) => deleteCard(id)));
      }
      if (uploadedPath) await removeCardImage(uploadedPath).catch(() => {});
      // Occlusion ist eine Pro-Funktion: bei 402/PAYWALL_REQUIRED hat der
      // request()-Helper (src/lib/api.ts) die Paywall bereits geöffnet — die
      // ist die Botschaft. Die englische Server-Meldung zusätzlich in ein rotes
      // Banner zu kippen, hinterlässt nach dem Schließen der Paywall nur einen
      // Rätsel-Rest auf einem sonst deutschen Bildschirm (#364).
      // Bewusst dieselbe Bedingung wie der globale Trigger: ein 402 mit einem
      // anderen Code öffnet KEINE Paywall und muss darum sichtbar bleiben.
      const paywallOpened = isApiError(e) && e.status === 402 && e.code === "PAYWALL_REQUIRED";
      if (!paywallOpened) {
        setError(
          isApiError(e) ? e.message : e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
        );
      }
      setSaving(false);
    }
  }

  const canSave = !!image && regions.length > 0 && !!deckId && !saving;
  const pct = (n: number) => `${n * 100}%` as const;

  const screenOptions = {
    title: "Occlusion",
    headerBackTitle: "Zurück",
    headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.background },
    // Disable the iOS swipe-back on this screen: a horizontal drawing drag
    // (especially near the left edge) was triggering the navigator's
    // back-swipe and popping the editor mid-marking (#207). Use the
    // header "Zurück" button to leave instead.
    gestureEnabled: false,
  };

  // Bestätigt "free" → Editor gar nicht erst anbieten. Bisher durfte man Bild
  // wählen und jedes Kästchen ziehen, und erst das Speichern schlug fehl (#364).
  // BEWUSST kein automatisches router.push zur Paywall: das würde beim
  // Zurücktippen sofort wieder feuern (Paywall → zurück → Editor → Paywall).
  // Hinweis + Knopf lassen die Wahl.
  if (proGate === "free") {
    return (
      <>
        {/* Hier wird nicht gezeichnet — also darf die Wisch-zurück-Geste (oben
            wegen #207 aus) auf diesem Hinweis wieder an sein. */}
        <Stack.Screen options={{ ...screenOptions, gestureEnabled: true }} />
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }}>
            <View style={{ width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={26} color={colors.accent} />
            </View>
            <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text, textAlign: "center" }}>
              Occlusion ist eine Pro-Funktion
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
              Mit Pro verdeckst du Teile eines Bildes und fragst sie ab — ideal für Diagramme,
              Skizzen und Landkarten.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              activeOpacity={0.85}
              style={{ alignSelf: "stretch", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radius.md, marginTop: spacing.sm }}
            >
              <Text style={{ color: "#ffffff", fontWeight: typography.semibold, fontSize: typography.base }}>
                Pro ansehen
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text }}>
              {isEditing ? "Occlusion bearbeiten" : "Occlusion-Karten"}
            </Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center" }}>
              {isEditing
                ? "Kästchen ändern oder ergänzen, dann speichern"
                : deckTitle
                  ? `Deck: ${deckTitle}`
                  : "Bild wählen, Kästchen ziehen, beschriften"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity
              onPress={pickFromGallery}
              disabled={processing}
              activeOpacity={0.8}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.md, opacity: processing ? 0.5 : 1 }}
            >
              <ImagePlus size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: typography.medium, fontSize: typography.base }}>
                {image ? "Anderes Bild" : "Galerie"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={takePhoto}
              disabled={processing}
              activeOpacity={0.8}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.md, opacity: processing ? 0.5 : 1 }}
            >
              <Camera size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: typography.medium, fontSize: typography.base }}>Kamera</Text>
            </TouchableOpacity>
          </View>
        </View>

        {processing ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>Bild wird verarbeitet …</Text>
          </View>
        ) : !image ? (
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
                      {isEditing
                        ? "Änderungen speichern"
                        : regions.length > 0
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
