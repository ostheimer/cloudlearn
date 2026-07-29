import { View, Text } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import type { TestAttemptSummary } from "../lib/api";
import {
  examPercentOverShown,
  percent,
  ratePercent,
  relativeDay,
  showsGapNote,
  TEST_ATTEMPTS_SHOWN,
} from "../lib/testAttemptsView";

/**
 * Der Prüfungs-Bereich der Statistik in der App — Gegenstück zum Web
 * (TestAttemptsPanel). Eine Prüfung misst unter Druck; ihre Quote steht deshalb
 * hier, getrennt von der Lern-Trefferquote, ehrlich neben der selbst
 * vergebenen. Anzeige-only: geschrieben wird beim Abgeben über recordTestAttempt
 * (#487).
 */
export function TestAttemptsCard({
  attempts,
  selfGradedRate,
}: {
  attempts: TestAttemptSummary[];
  /** „Aus dem Kopf gewusst"-Quote (0..1). null/undefined -> noch keine selbst
   *  bewerteten Antworten: dann steht ein Strich, wie in „Trefferquote
   *  genauer" darüber (Laras Entscheidung, #595). */
  selfGradedRate: number | null | undefined;
}) {
  const colors = useColors();

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  const titleStyle = {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
  } as const;

  // Dieselbe Ampel wie im Web: unter 60 rot, unter 80 gelb, sonst grün.
  const scoreColor = (pct: number) =>
    pct < 60 ? colors.error : pct < 80 ? colors.warning : colors.success;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <CheckCircle2 size={18} color={colors.primary} />
      <Text style={titleStyle}>Prüfungen</Text>
    </View>
  );

  // Noch keine Prüfung: ehrlicher Leerzustand statt einer leeren Karte.
  if (attempts.length === 0) {
    return (
      <View style={{ ...cardStyle, gap: spacing.md }}>
        {header}
        <View style={{ alignItems: "center", paddingVertical: spacing.md, gap: spacing.sm }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={20} color={colors.textSecondary} />
          </View>
          <Text style={{ ...titleStyle }}>Noch keine Prüfung gemacht</Text>
          <Text
            style={{
              fontSize: typography.sm,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Eine Prüfung misst ehrlicher als das Lernen mit Umdrehen — dort bewertest du
            selbst, ob du es wusstest. Mach eine Prüfung, dann siehst du hier, wie du
            wirklich abschneidest.
          </Text>
        </View>
      </View>
    );
  }

  const shown = attempts.slice(0, TEST_ATTEMPTS_SHOWN);
  const examPct = examPercentOverShown(shown);
  const selfPct = ratePercent(selfGradedRate ?? null);
  const gapNote = showsGapNote(examPct, selfPct);

  const tile = (value: string, label: string, color: string, faded: boolean) => (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: radius.md,
        padding: spacing.md,
        opacity: faded ? 0.6 : 1,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: typography.semibold, color }}>{value}</Text>
      <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ ...cardStyle, gap: spacing.md }}>
      {header}

      {/* Vergleich: gemessen betont, selbst vergeben blass daneben. Strich
          statt „0 %", solange nichts selbst bewertet wurde — dieselbe leere
          Datenlage zeigt der Kasten darüber auch als Strich (#595). */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {tile(`${examPct} %`, "in Prüfungen", scoreColor(examPct), false)}
        {tile(selfPct != null ? `${selfPct} %` : "—", "selbst bewertet", colors.text, true)}
      </View>

      {/* Ruhige Einordnung (kein Alarm), nur wenn die Prüfung wirklich tiefer liegt. */}
      {gapNote && (
        <Text
          style={{
            fontSize: typography.sm,
            color: colors.textSecondary,
            lineHeight: 19,
            backgroundColor: colors.background,
            borderRadius: radius.sm,
            padding: spacing.md,
          }}
        >
          Prüfungen sind anspruchsvoller — solche Unterschiede sind ganz normal.
        </Text>
      )}

      <View>
        <Text
          style={{
            fontSize: typography.xs,
            color: colors.textTertiary,
            marginBottom: spacing.xs,
          }}
        >
          {shown.length === 1 ? "Deine letzte Prüfung" : `Deine letzten ${shown.length} Prüfungen`}
        </Text>
        {shown.map((attempt, index) => {
          const pct = percent(attempt.correctCount, attempt.questionCount);
          return (
            <View
              key={attempt.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.borderLight,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: typography.base, color: colors.text }}>
                  {attempt.deckTitle || "Ohne Deck"}
                </Text>
                <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
                  {relativeDay(attempt.submittedAt)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ fontSize: typography.base, fontWeight: typography.semibold, color: scoreColor(pct) }}
                >
                  {pct} %
                </Text>
                <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
                  {attempt.correctCount} von {attempt.questionCount}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
