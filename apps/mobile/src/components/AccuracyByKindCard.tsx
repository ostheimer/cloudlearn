import { View, Text } from "react-native";
import { Target } from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";

/**
 * Die Trefferquote, getrennt nach der Art der Antwort — Gegenstück zum Web
 * (accuracy-by-kind.tsx).
 *
 * Warum es das gibt: die eine Quote in „Genauigkeit" mischt zwei sehr
 * verschiedene Leistungen — eine Karte umdrehen und ehrlich „wusste ich nicht"
 * tippen, gegen die richtige von vier Kacheln treffen. Seit Multiple Choice und
 * Zuordnen mitzählen, hebt Raten die Gesamtzahl, ohne dass eine Karte aus dem
 * Kopf kam. Getrennt bleibt sichtbar, was wirklich saß.
 *
 * Die Zahlen kommen fertig vom Server (`accuracyByKind`); hier wird nichts
 * gerechnet außer Prozent und Balkenbreite. Wortlaute und Ampel-Schwellen sind
 * bewusst identisch zum Web — zwei Seiten, die bei 61 % anders entscheiden oder
 * dieselbe Zeile anders benennen, liest niemand als Absicht.
 */
export type AccuracyKind = { rate: number; answers: number };

export type AccuracyByKind = {
  recall: AccuracyKind;
  recognition: AccuracyKind;
};

// Die Beschriftungen sind gleich gebaut — „Aus dem Kopf" gegen „Aus den
// Antworten" —, damit nur der mittlere Teil den Unterschied trägt. Zwei frühere
// Fassungen sind daran gescheitert und sollen nicht zurückkommen: „Beim
// Aufwärmen getroffen" (Sport-Bild, das die App nirgends erklärt, und es klingt,
// als wäre Multiple Choice kein richtiges Lernen) und „Aus der Auswahl erkannt"
// („Auswahl" meint in genau diesen Modi schon die vorgenommenen Karten).
const ROWS = [
  {
    key: "recall" as const,
    label: "Aus dem Kopf gewusst",
    // „Üben" (Wackelkandidaten, mode "practice") zählt in dieser Quote mit,
    // steht aber bewusst nicht dabei: als Kachel gibt es den Modus nirgends,
    // und im Web existiert er gar nicht (#498, Punkt 5).
    modes: "Karteikarten · Lückentext · Occlusion",
  },
  {
    key: "recognition" as const,
    // Plural, weil es auch fürs Zuordnen stimmen muss: dort liegen viele
    // Kacheln offen, statt vier Antworten zu einer Frage.
    label: "Aus den Antworten erkannt",
    modes: "Multiple Choice · Zuordnen",
  },
];

export function AccuracyByKindCard({ data }: { data: AccuracyByKind }) {
  const colors = useColors();

  // Dieselbe Ampel wie im Web und im Prüfungs-Bereich: unter 60 rot, unter 80
  // gelb, sonst grün.
  const accColor = (pct: number) =>
    pct < 60 ? colors.error : pct < 80 ? colors.warning : colors.success;

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  } as const;

  // Nichts davon gemacht: dann sind zwei Striche keine Information, sondern nur
  // eine leere Karte mehr auf einer ohnehin vollen Seite.
  if (data.recall.answers === 0 && data.recognition.answers === 0) return null;

  return (
    <View style={{ ...cardStyle, gap: spacing.md }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
      >
        <Target size={18} color={colors.primary} />
        <Text
          style={{
            fontSize: typography.base,
            fontWeight: typography.semibold,
            color: colors.text,
          }}
        >
          Trefferquote genauer
        </Text>
      </View>

      <Text
        style={{
          fontSize: typography.sm,
          color: colors.textSecondary,
          lineHeight: 20,
          marginTop: -spacing.xs,
        }}
      >
        Die Zahl oben fasst beides zusammen. Getrennt siehst du, was du wirklich
        aus dem Kopf konntest.
      </Text>

      <View style={{ gap: spacing.lg }}>
        {ROWS.map((row) => {
          const { rate, answers } = data[row.key];
          const has = answers > 0;
          const pct = Math.round(rate <= 1 ? rate * 100 : rate);
          return (
            <View key={row.key} style={{ gap: spacing.xs }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.sm,
                    fontWeight: typography.medium,
                    color: colors.text,
                    flex: 1,
                  }}
                >
                  {row.label}
                </Text>
                {/* Strich statt „0 %", solange die Gruppe leer ist: 0 % wäre
                    eine Behauptung über Antworten, die es nicht gibt. */}
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.semibold,
                    color: has ? accColor(pct) : colors.textTertiary,
                  }}
                >
                  {has ? `${pct} %` : "—"}
                </Text>
              </View>

              {/* Balken, damit sich die beiden Quoten ohne Rechnen vergleichen
                  lassen. Die graue Schiene muss sichtbar bleiben, sonst fehlt
                  dem farbigen Teil der Bezug: 52 % sähen aus wie ein Balken,
                  der einfach da aufhört, statt wie gut die Hälfte. */}
              <View
                style={{
                  height: 8,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceSecondary,
                  overflow: "hidden",
                }}
              >
                {has ? (
                  <View
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: radius.full,
                      backgroundColor: accColor(pct),
                    }}
                  />
                ) : null}
              </View>

              <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>
                {row.modes}
                {" · "}
                {has
                  ? `${answers.toLocaleString("de-DE")} ${
                      answers === 1 ? "Antwort" : "Antworten"
                    }`
                  : "noch nicht gemacht"}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={{ fontSize: typography.xs, color: colors.textTertiary }}>
        Prüfungen zählen hier nicht mit — die haben ihren eigenen Bereich.
      </Text>
    </View>
  );
}
