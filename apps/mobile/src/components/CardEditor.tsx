import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Check } from "lucide-react-native";
import { difficultyLabel } from "../lib/cardLabels";
import { useColors, spacing, radius, typography } from "../theme";

/**
 * Karte anlegen oder bearbeiten — geteilt zwischen der Deck-Ansicht und dem
 * Stift-Knopf in der Karteikarten-Runde (#610). Bewusst OHNE Kartentyp-
 * Schalter: die Achse basic↔cloze leitet der Server aus dem Text ab
 * ({{cN::…}}-Markierung oder ______-Lücke) — ein von Hand gesetztes Etikett
 * konnte nur lügen, denn eine Lücke gibt es nur, wenn sie im Text steht.
 */
export default function CardEditor({
  visible,
  card,
  saving,
  onSave,
  onCancel,
}: {
  visible: boolean;
  card: {
    front: string;
    back: string;
    difficulty: string;
  } | null;
  saving: boolean;
  onSave: (data: { front: string; back: string; difficulty: string }) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setDifficulty(card.difficulty);
    } else {
      setFront("");
      setBack("");
      setDifficulty("medium");
    }
  }, [card, visible]);

  const isValid = front.trim().length > 0 && back.trim().length > 0;

  // Nachfrage vor dem Verwerfen (#608, wortgleich zum Web): „Abbrechen" und
  // die Android-Zurück-Taste werfen sonst halbfertigen Text kommentarlos weg.
  const dirty =
    front !== (card?.front ?? "") ||
    back !== (card?.back ?? "") ||
    difficulty !== (card?.difficulty ?? "medium");

  const requestClose = () => {
    // Während des Speicherns nicht schließen — sonst wüsste niemand, ob die
    // Karte angekommen ist.
    if (saving) return;
    if (!dirty) {
      onCancel();
      return;
    }
    Alert.alert("Änderungen verwerfen?", "Dein eingetippter Text geht sonst verloren.", [
      // „Weiter bearbeiten" ist der cancel-Knopf (betont): Wer aus Versehen
      // rausgeht, kommt am leichtesten zurück zum Text.
      { text: "Weiter bearbeiten", style: "cancel" },
      { text: "Verwerfen", style: "destructive", onPress: onCancel },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android-Zurück-Taste (#608) — vorher tat sie hier nichts.
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TouchableOpacity
              onPress={requestClose}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <X size={18} color={colors.textSecondary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: typography.base,
                }}
              >
                Abbrechen
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                fontWeight: typography.bold,
                fontSize: typography.lg,
                color: colors.text,
              }}
            >
              {card ? "Karte bearbeiten" : "Neue Karte"}
            </Text>
            <TouchableOpacity
              onPress={() =>
                onSave({
                  front: front.trim(),
                  back: back.trim(),
                  difficulty,
                })
              }
              // `saving` sperrt gegen Doppeltippen (#608): Jeder weitere Tipp
              // legte sonst dieselbe Karte noch einmal an.
              disabled={!isValid || saving}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <Check
                size={18}
                color={isValid && !saving ? colors.primary : colors.textTertiary}
              />
              <Text
                style={{
                  color: isValid && !saving ? colors.primary : colors.textTertiary,
                  fontSize: typography.base,
                  fontWeight: typography.bold,
                }}
              >
                {/* Wie im Web (#571): eine NEUE Karte wird „hinzugefügt", eine
                    bestehende „gespeichert". Vorher hieß beides „Speichern". */}
                {saving ? "Speichert …" : card ? "Speichern" : "Hinzufügen"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          >
            {/* Front */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Vorderseite (Frage)
              </Text>
              <TextInput
                value={front}
                onChangeText={setFront}
                // Ohne Platzhalter wie im Web (#571): Die Beschriftung steht
                // schon über dem Feld und bleibt beim Tippen stehen — der
                // Platzhalter verschwand genau dann, wenn man ihn braucht.
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  color: colors.text,
                }}
              />
            </View>

            {/* Back */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Rückseite (Antwort)
              </Text>
              <TextInput
                value={back}
                onChangeText={setBack}
                // Ohne Platzhalter wie im Web (#571) — siehe Vorderseite.
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  color: colors.text,
                }}
              />
            </View>

            {/* Difficulty selector */}
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  fontWeight: typography.semibold,
                  color: colors.textSecondary,
                  fontSize: typography.sm,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Schwierigkeit
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {(["easy", "medium", "hard"] as const).map((d) => {
                  // Wortlaut aus dem geteilten Helfer (#609), damit Deck-Ansicht
                  // und Scan-Vorschau nie auseinanderlaufen; Farben bleiben hier.
                  const tone = {
                    easy: { color: colors.success, bg: colors.successLight },
                    medium: { color: colors.warning, bg: colors.warningLight },
                    hard: { color: colors.error, bg: colors.errorLight },
                  };
                  const label = difficultyLabel(d);
                  const { color, bg } = tone[d];
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDifficulty(d)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: radius.md,
                        borderWidth: 2,
                        borderColor:
                          difficulty === d ? color : colors.border,
                        backgroundColor:
                          difficulty === d ? bg : colors.surface,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: typography.semibold,
                          color:
                            difficulty === d
                              ? color
                              : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
