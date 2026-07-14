import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, ImagePlus, Trophy, X, Zap } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../src/theme";
import { useSessionStore } from "../src/store/sessionStore";
import { listCardsInDeck, reviewCard, earnLp } from "../src/lib/api";
import { parseOcclusionCard, type OcclusionStudyItem } from "../src/lib/occlusion";
import { getCardImageSignedUrl } from "../src/lib/occlusionStorage";

const LP_SESSION_MIN = 5;
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
  const { deckId, deckTitle } = useLocalSearchParams<{ deckId?: string; deckTitle?: string }>();

  const [items, setItems] = useState<OcclusionStudyItem[]>([]);
  const [media, setMedia] = useState<Record<string, Media | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<"setup" | "study">("setup");
  const [maskOthers, setMaskOthers] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<OcclusionStudyItem[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const awardedRef = useRef(false);
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

  useEffect(() => {
    void load();
  }, [load]);

  const total = items.length;
  const current = items[index];
  const done = phase === "study" && index >= total;

  const awardSession = useCallback(async (count: number) => {
    if (awardedRef.current || count < LP_SESSION_MIN) return;
    awardedRef.current = true;
    try {
      const res = await earnLp("session", count);
      setEarned(res.granted);
      setEarnCapReached(res.capReached);
    } catch {
      /* LP-Gutschrift ist best-effort */
    }
  }, []);

  useEffect(() => {
    if (done) void awardSession(total);
  }, [done, total, awardSession]);

  function rate(known: boolean) {
    const item = items[index];
    if (!item || !userId) return;
    if (known) setCorrect((n) => n + 1);
    else setWrong((w) => [...w, item]);
    reviewCard(userId, item.id, known ? "good" : "again").catch(() => {});
    setRevealed(false);
    setTimeout(() => setIndex((i) => i + 1), 140);
  }

  function restart() {
    awardedRef.current = false;
    setEarned(null);
    setEarnCapReached(false);
    setItems(allItemsRef.current);
    setIndex(0);
    setRevealed(false);
    setCorrect(0);
    setWrong([]);
    setPhase("setup");
  }

  function restartWrong() {
    const subset = wrong;
    awardedRef.current = false;
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

  const screenHeader = (
    <Stack.Screen
      options={{
        title: "Bild-Abdecken",
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
    return wrap(
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }}>
        <Trophy size={56} color={colors.warning} />
        <Text style={{ fontSize: typography.xl, fontWeight: typography.bold, color: colors.text }}>Session geschafft!</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
          Du hast {total} {total === 1 ? "Bereich" : "Bereiche"} durchgegangen — {correct} davon sicher gewusst.
        </Text>
        {earned !== null && earned > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.successLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full }}>
            <Zap size={15} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: typography.semibold }}>+{earned} Lernpunkte</Text>
          </View>
        )}
        {earned === 0 && earnCapReached && (
          <Text style={{ color: colors.textSecondary, fontSize: typography.sm, textAlign: "center" }}>
            Heutiges Lernpunkte-Limit erreicht — morgen gibt es wieder welche.
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center", marginTop: spacing.sm }}>
          {wrong.length > 0 && (
            <TouchableOpacity onPress={restartWrong} style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md }}>
              <Text style={{ color: "#fff", fontWeight: typography.semibold }}>Nur nicht gewusste ({wrong.length})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={restart} style={{ backgroundColor: wrong.length > 0 ? colors.surfaceSecondary : colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md }}>
            <Text style={{ color: wrong.length > 0 ? colors.text : "#fff", fontWeight: typography.semibold }}>
              {wrong.length > 0 ? "Nochmal alle" : "Nochmal lernen"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToDeck} style={{ backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md }}>
            <Text style={{ color: colors.text, fontWeight: typography.semibold }}>Zurück zum Deck</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>,
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
        <TouchableOpacity onPress={() => { void awardSession(index); goToDeck(); }} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <X size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: typography.sm }}>Beenden</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, height: 5, backgroundColor: colors.surfaceSecondary, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ width: `${(index / total) * 100}%`, height: "100%", backgroundColor: colors.primary }} />
        </View>
        <Text style={{ color: colors.textSecondary, fontWeight: typography.semibold, fontSize: typography.sm }}>{index + 1} / {total}</Text>
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
