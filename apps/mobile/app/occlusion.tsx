import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, ImagePlus, Pencil, Trash2, X, Zap } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";
import { StudyResult } from "../src/components/StudyResult";
import { useSessionStore } from "../src/store/sessionStore";
import { listCardsInDeck, earnLp, deleteCard } from "../src/lib/api";
import { sendReview } from "../src/features/sync/sendReview";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "../src/lib/learn-session-lp";
import { setLastUsedDeck } from "../src/lib/lastUsedDeck";
import {
  parseOcclusionCard,
  groupOcclusionCards,
  type OcclusionStudyItem,
  type OcclusionImageGroup,
} from "../src/lib/occlusion";
import { getCardImageSignedUrl, removeCardImage } from "../src/lib/occlusionStorage";
import { useDisplayName } from "../src/lib/useDisplayName";

type Media = { url: string; aspect: number };

async function imageAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    Image.getSize(
      url,
      (w, h) => resolve(w && h ? w / h : 4 / 3),
      () => resolve(4 / 3),
    );
  });
}

export default function OcclusionStudyScreen() {
  const colors = useColors();
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);
  const displayName = useDisplayName();
  const { deckId, deckTitle } = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();

  // Studying IS using the deck (#415).
  useEffect(() => {
    if (deckId) void setLastUsedDeck({ id: deckId, title: deckTitle ?? "" });
  }, [deckId, deckTitle]);

  const [items, setItems] = useState<OcclusionStudyItem[]>([]);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const [phase, setPhase] = useState<"setup" | "study">("setup");
  const [maskOthers, setMaskOthers] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<OcclusionStudyItem[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  const allItemsRef = useRef<OcclusionStudyItem[]>([]);

  const load = useCallback(async () => {
    if (!deckId) {
      setLoading(false);
      return;
    }
    try {
      const { cards } = await listCardsInDeck(deckId);
      const occ = cards
        .map((c) => parseOcclusionCard(c))
        .filter((o): o is OcclusionStudyItem => o !== null);
      allItemsRef.current = occ;
      setItems(occ);
      if (occ.length > 0) {
        const paths = Array.from(new Set(occ.map((o) => o.path)));
        const entries = await Promise.all(
          paths.map(async (p) => {
            const url = await getCardImageSignedUrl(p);
            if (!url) return [p, null] as const;
            return [p, { url, aspect: await imageAspect(url) }] as const;
          }),
        );
        setMedia(Object.fromEntries(entries));
      }
      setError(null);
    } catch {
      setError("Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  // Reload on every focus so the "Deine Bilder" list reflects edits made in the
  // editor (which replaces cards) and deletions, not just the first mount.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const total = items.length;
  const current = items[index];
  const done = phase === "study" && index >= total;

  const awardSession = useCallback((count: number) => {
    const state = awardStateRef.current;
    return beginSessionAward(state, count, async () => {
      try {
        const maxAttempts = 3;
        const retryDelayMs = 250;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }

          const pendingReviews = pendingReviewsRef.current;
          pendingReviewsRef.current = [];
          await Promise.allSettled(pendingReviews);

          const res = await earnLp("session", count);
          setEarned(res.granted);
          setEarnCapReached(res.capReached);

          if (isSessionEarnFinalized(res, count)) {
            state.finalized = true;
            break;
          }
        }
      } catch {
        /* LP-Gutschrift ist best-effort */
      }
    });
  }, []);

  useEffect(() => {
    if (done) void awardSession(total);
  }, [done, total, awardSession]);

  function rate(known: boolean) {
    const item = items[index];
    if (!item || !userId) return;
    if (known) setCorrect((n) => n + 1);
    else setWrong((w) => [...w, item]);
    const reviewPromise = sendReview({
      userId,
      cardId: item.id,
      rating: known ? "good" : "again",
      mode: "occlusion",
    });
    pendingReviewsRef.current.push(reviewPromise);
    setRevealed(false);
    setTimeout(() => setIndex((i) => i + 1), 140);
  }

  async function restart() {
    await awardSession(total);
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setItems(allItemsRef.current);
    setIndex(0);
    setRevealed(false);
    setCorrect(0);
    setWrong([]);
    setPhase("setup");
  }

  async function restartWrong() {
    const subset = wrong;
    await awardSession(total);
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setItems(subset);
    setIndex(0);
    setRevealed(false);
    setCorrect(0);
    setWrong([]);
    setPhase("study");
  }

  function goToDeck() {
    router.back();
  }
  function goToEditor() {
    router.push({ pathname: "/occlusion-editor", params: { deckId: deckId ?? "", deckTitle: deckTitle ?? "" } });
  }

  // Open the editor pre-filled with this image's boxes. On save the editor
  // replaces the old cards (replaceCardIds) so editing never leaves duplicates.
  function editImage(group: OcclusionImageGroup) {
    router.push({
      pathname: "/occlusion-editor",
      params: {
        deckId: deckId ?? "",
        deckTitle: deckTitle ?? "",
        editPath: group.path,
        editRegions: JSON.stringify(group.regions),
        replaceCardIds: JSON.stringify(group.cardIds),
      },
    });
  }

  // Delete a whole image: all its cards, then the stored file. Confirmed first
  // because it is irreversible.
  function deleteImage(group: OcclusionImageGroup) {
    const count = group.cardIds.length;
    Alert.alert(
      "Bild löschen?",
      count === 1
        ? "Das Bild und die zugehörige Karte werden dauerhaft gelöscht."
        : `Das Bild und alle ${count} zugehörigen Karten werden dauerhaft gelöscht.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            setDeletingPath(group.path);
            try {
              for (const id of group.cardIds) {
                await deleteCard(id);
              }
              await removeCardImage(group.path);
              await load();
            } catch {
              Alert.alert("Fehler", "Löschen fehlgeschlagen. Bitte versuche es noch einmal.");
            } finally {
              setDeletingPath(null);
            }
          },
        },
      ],
    );
  }

  const imageGroups = groupOcclusionCards(items);

  const screenHeader = (
    <Stack.Screen
      options={{
        title: "Occlusion",
        headerBackTitle: "Zurück",
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    />
  );

  const wrap = (children: React.ReactNode) => (
    <>
      {screenHeader}
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
        {children}
      </SafeAreaView>
    </>
  );

  if (loading) {
    return wrap(
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>,
    );
  }

  if (error) {
    return wrap(
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }}>
        <AlertTriangle size={30} color={colors.error} />
        <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text }}>Konnte nicht laden</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Text>
        <TouchableOpacity onPress={goToDeck} style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md }}>
          <Text style={{ color: "#fff", fontWeight: typography.semibold }}>Zurück zum Deck</Text>
        </TouchableOpacity>
      </View>,
    );
  }

  if (total === 0) {
    return wrap(
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center" }}>
          <ImagePlus size={30} color={colors.success} />
        </View>
        <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text }}>Noch keine Occlusion-Karten</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center", paddingHorizontal: spacing.lg }}>
          Lade zuerst ein Bild hoch und markiere die Bereiche, die du lernen möchtest.
        </Text>
        <TouchableOpacity onPress={goToEditor} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md }}>
          <ImagePlus size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: typography.semibold }}>Occlusion-Karten erstellen</Text>
        </TouchableOpacity>
      </View>,
    );
  }

  if (done) {
    const lpAccessory =
      earned !== null && earned > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.successLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full }}>
          <Zap size={15} color={colors.success} />
          <Text style={{ color: colors.success, fontWeight: typography.semibold }}>+{earned} Lernpunkte</Text>
        </View>
      ) : earned === 0 && earnCapReached ? (
        <Text style={{ color: colors.textSecondary, fontSize: typography.sm, textAlign: "center" }}>
          Heutiges Lernpunkte-Limit erreicht — morgen gibt es wieder welche.
        </Text>
      ) : null;
    return wrap(
      <StudyResult
        headline={`Runde geschafft${displayName ? `, ${displayName}` : ""}!`}
        // „Bereiche" statt „Karten" (Laras Entscheidung, #595): ein Bild kann
        // mehrere verdeckte Bereiche tragen — gezählt wird, was geübt wurde.
        // Wortgleich mit dem Web (occlusion/page.tsx).
        subtitle={`Du hast ${total} ${
          total === 1 ? "Bereich" : "Bereiche"
        } durchgegangen — ${correct} davon sicher gewusst.`}
        accessory={lpAccessory}
        actions={[
          ...(wrong.length > 0
            ? [{ label: `Nur die nicht gewussten (${wrong.length})`, onPress: restartWrong, variant: "primary" as const }]
            : []),
          {
            label: "Alle nochmal",
            onPress: restart,
            variant: wrong.length > 0 ? ("secondary" as const) : ("primary" as const),
            reload: true,
          },
          { label: "Zurück zum Deck", onPress: goToDeck, variant: "ghost" as const },
        ]}
      />,
    );
  }

  if (phase === "setup") {
    return wrap(
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.successLight, alignItems: "center", justifyContent: "center" }}>
            <ImagePlus size={24} color={colors.success} />
          </View>
          <Text style={{ fontSize: typography.lg, fontWeight: typography.semibold, color: colors.text }}>Occlusion</Text>
          <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center" }}>
            {total} {total === 1 ? "Bereich" : "Bereiche"} — Bild ansehen, verdeckten Teil erraten, aufdecken
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setMaskOthers((m) => !m)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}>Andere Bereiche mitverdecken</Text>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
              {maskOthers ? "Fairer: alle anderen Markierungen sind auch verdeckt" : "Leichter: nur der gefragte Bereich ist verdeckt"}
            </Text>
          </View>
          <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: maskOthers ? colors.primary : colors.border, justifyContent: "center", paddingHorizontal: 3 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", alignSelf: maskOthers ? "flex-end" : "flex-start" }} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setPhase("study")} style={{ backgroundColor: colors.primary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: typography.semibold, fontSize: typography.base }}>Starten</Text>
        </TouchableOpacity>

        {imageGroups.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textSecondary, letterSpacing: 0.6, textTransform: "uppercase" }}>
              Deine Bilder
            </Text>
            {imageGroups.map((group) => {
              const gm = media[group.path];
              const busy = deletingPath === group.path;
              const labels = group.regions.map((r) => r.label).filter(Boolean).join(", ");
              return (
                <View
                  key={group.path}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm }}
                >
                  <View style={{ width: 52, height: 52, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                    {gm ? (
                      <Image source={{ uri: gm.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <ImagePlus size={20} color={colors.textTertiary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}>
                      {group.regions.length} {group.regions.length === 1 ? "Bereich" : "Bereiche"}
                    </Text>
                    {labels ? (
                      <Text numberOfLines={1} style={{ fontSize: typography.sm, color: colors.textSecondary }}>{labels}</Text>
                    ) : null}
                  </View>
                  {busy ? (
                    <View style={{ width: 84, alignItems: "center" }}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => editImage(group)} hitSlop={8} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                        <Pencil size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteImage(group)} hitSlop={8} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={18} color={colors.error} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity onPress={goToEditor} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm }}>
          <ImagePlus size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontWeight: typography.medium }}>Weitere Occlusion-Karten erstellen</Text>
        </TouchableOpacity>
      </ScrollView>,
    );
  }

  const m = current ? media[current.path] : null;

  return wrap(
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <TouchableOpacity
          onPress={() => {
            void (async () => {
              const reviewedCount = getSessionReviewedCount(index, pendingReviewsRef.current.length);
              await awardSession(reviewedCount);
              goToDeck();
            })();
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <X size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>Beenden</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, height: 5, backgroundColor: colors.surfaceSecondary, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ width: `${(index / total) * 100}%`, height: "100%", backgroundColor: colors.primary }} />
        </View>
        <Text style={{ color: colors.textSecondary, fontWeight: typography.semibold, fontSize: typography.sm }}>Karte {index + 1} von {total}</Text>
      </View>

      {current && (
        <>
          <View style={{ position: "relative", width: "100%", aspectRatio: m?.aspect ?? 4 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceSecondary }}>
            {m ? (
              <Image source={{ uri: m.url }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
                <AlertTriangle size={26} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>Bild konnte nicht geladen werden.</Text>
              </View>
            )}
            {m && current.regions.map((r, j) => {
              if (j === current.hideIndex) {
                if (revealed) return null;
                return (
                  <View key={j} style={{ position: "absolute", left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, backgroundColor: colors.text, borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.background, fontSize: typography.lg, fontWeight: typography.semibold }}>?</Text>
                  </View>
                );
              }
              if (!maskOthers) return null;
              return (
                <View key={j} style={{ position: "absolute", left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, backgroundColor: colors.textTertiary, borderRadius: 4 }} />
              );
            })}
          </View>

          <Text style={{ textAlign: "center", color: colors.textSecondary, fontSize: typography.base }}>Was ist an der markierten Stelle?</Text>
          <Text style={{ textAlign: "center", color: colors.success, fontSize: typography.lg, fontWeight: typography.semibold, minHeight: 24 }}>
            {revealed ? current.label : " "}
          </Text>

          {revealed ? (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <TouchableOpacity onPress={() => rate(false)} style={{ flex: 1, backgroundColor: colors.errorLight, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" }}>
                <Text style={{ color: colors.error, fontWeight: typography.semibold }}>Nochmal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => rate(true)} style={{ flex: 1, backgroundColor: colors.successLight, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" }}>
                <Text style={{ color: colors.success, fontWeight: typography.semibold }}>Gewusst</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setRevealed(true)} style={{ backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: typography.semibold, fontSize: typography.base }}>Aufdecken</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>,
  );
}
