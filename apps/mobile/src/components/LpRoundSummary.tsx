import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useUsageStore } from "../store/usageStore";

interface LpRoundSummaryProps {
  /** Gutgeschriebene Punkte dieser Runde. `null` = noch nicht abgerechnet. */
  earned: number | null;
  /** Sagte der Server, dass der Tagesdeckel greift? */
  capReached: boolean;
  /** Fertiger Text wie "Tagesziel: 28/30 — noch 2" (#610), `null`/`undefined` = noch nicht geladen oder kein Ziel gesetzt. */
  dailyGoalText?: string | null;
}

/**
 * Was am Ende einer Lernrunde über die Lernpunkte gesagt wird (#611).
 *
 * Vorher sagten fünf der sechs Modi NICHTS: Nur Bild-Abdecken zeigte den
 * Deckel-Satz — dort hartkodiert. Quiz und Zuordnen hatten eine Pille, die bei
 * 0 Punkten einfach verschwand, mit dem Kommentar „dann steht hier nichts,
 * statt +0 Lernpunkte zu behaupten". Richtig gedacht, aber die Frage blieb
 * offen: Wer 20 Karten lernt und keine Punkte bekommt, hält es für einen Fehler.
 *
 * Deshalb EINE Komponente für alle Modi statt sechs Kopien — so kann der
 * Wortlaut nicht auseinanderlaufen, und ein Modus kann den Deckel nicht mehr
 * versehentlich verschweigen.
 *
 * Drei Fälle:
 *  - Punkte gekommen  → Pille „+N Lernpunkte"
 *  - 0 und Deckel     → Satz + Tagesstand („Heute verdient: 30 / 30 LP")
 *  - 0 ohne Deckel    → nichts. Dann wurde nichts gelernt (leere Runde) oder die
 *                       Abrechnung läuft noch; eine Meldung wäre hier Rauschen.
 */
export function LpRoundSummary({ earned, capReached, dailyGoalText }: LpRoundSummaryProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const lpEarnCapToday = useUsageStore((state) => state.lpEarnCapToday);

  // Tagesziel-Zeile (#610): unabhängig vom LP-Fall, deshalb unten an jeden der
  // drei Zweige angehängt statt ein vierter eigener Fall zu werden.
  const goalLine = dailyGoalText ? (
    <Text
      style={{
        color: colors.textTertiary,
        fontSize: typography.xs,
        textAlign: "center",
      }}
    >
      {dailyGoalText}
    </Text>
  ) : null;

  if (earned !== null && earned > 0) {
    return (
      <View style={{ gap: spacing.xs, alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            alignSelf: "center",
            backgroundColor: colors.successLight,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            paddingVertical: 6,
          }}
        >
          <Zap size={15} color={colors.success} />
          <Text
            style={{
              color: colors.success,
              fontSize: typography.sm,
              fontWeight: typography.semibold,
            }}
          >
            {t("lp.earnedThisRound", { count: earned })}
          </Text>
        </View>
        {goalLine}
      </View>
    );
  }

  if (earned === 0 && capReached) {
    return (
      <View style={{ gap: 2 }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: typography.sm,
            textAlign: "center",
          }}
        >
          {t("lp.earnCapReachedToday")}
        </Text>
        {/* Der Tagesstand macht den Satz überprüfbar. Ist der Deckel erreicht,
            IST „heute verdient" gleich dem Deckel — der Wert muss also nicht
            eigens vom Server geholt werden. */}
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: typography.xs,
            textAlign: "center",
          }}
        >
          {t("lp.earnToday", { count: lpEarnCapToday, cap: lpEarnCapToday })}
        </Text>
        {goalLine}
      </View>
    );
  }

  return goalLine;
}
