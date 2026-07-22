/**
 * Eingabe-Fenster für eine einzelne Textzeile (Name anlegen / umbenennen).
 *
 * Ersetzt den Eingabe-Alert von iOS: den gibt es dort ausschliesslich. Auf
 * Android verpuffte der Aufruf wirkungslos — „Kurs anlegen", „Ordner anlegen"
 * und jedes Umbenennen waren dort schlicht tote Knöpfe (#396).
 *
 * Bewusst dumm gehalten: Sichtbarkeit und Wert gehören dem aufrufenden
 * Bildschirm. Optisch nach `LpInsufficientModal` gebaut — dem anderen
 * Bodenblatt der App (von unten eingeschoben, abgerundete Oberkante).
 */
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors, spacing, radius, typography, shadows } from "../theme";

interface TextPromptModalProps {
  visible: boolean;
  /** Überschrift des Fensters, z. B. „Ordner umbenennen". */
  title: string;
  /** Zeile über dem Eingabefeld, z. B. „Neuer Name für ...". */
  label: string;
  placeholder?: string;
  /** Vorbelegung — beim Umbenennen der bisherige Name. */
  initialValue?: string;
  /** Beschriftung des bestätigenden Knopfes, z. B. „Speichern" / „Erstellen". */
  confirmLabel: string;
  /** Gezeichnetes Symbol neben der Überschrift (lucide-react-native). */
  icon: LucideIcon;
  /** Mehrzeiliges Feld — für Freitext wie die Ordner-Beschreibung (#437). */
  multiline?: boolean;
  /**
   * Leeres Abschicken zulassen. Namen dürfen nie leer sein, eine Beschreibung
   * schon — leer speichern ist dort der Weg, sie wieder zu löschen.
   */
  allowEmpty?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export default function TextPromptModal({
  visible,
  title,
  label,
  placeholder,
  initialValue,
  confirmLabel,
  icon: Icon,
  multiline = false,
  allowEmpty = false,
  onCancel,
  onSubmit,
}: TextPromptModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue ?? "");

  // Beim Öffnen zurücksetzen: sonst stünde beim nächsten Umbenennen noch der
  // Name des vorigen Decks im Feld (gleiches Muster wie in DeckEditModal).
  useEffect(() => {
    if (visible) setValue(initialValue ?? "");
  }, [visible, initialValue]);

  const isValid = allowEmpty || value.trim().length > 0;

  // Ein leerer Name wurde auch vorher verworfen — der Knopf bleibt deshalb
  // gesperrt, und die Eingabetaste löst dann ebenfalls nichts aus.
  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
        {/* Fläche über dem Blatt: Tippen schliesst, wie das Wegtippen eines
            Alerts. Eigene Fläche statt Verschachtelung, damit ein Tipp INS
            Blatt (etwa ins Eingabefeld) niemals versehentlich schliesst. */}
        <Pressable style={{ flex: 1 }} onPress={onCancel} accessibilityRole="button" />

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: spacing.xxl,
              gap: spacing.lg,
              ...shadows.xl,
            }}
          >
            {/* Kopfzeile: gezeichnetes Symbol + Überschrift */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Icon size={22} color={colors.primary} />
              <Text
                style={{
                  flex: 1,
                  fontSize: typography.xl,
                  fontWeight: typography.bold,
                  color: colors.text,
                }}
              >
                {title}
              </Text>
            </View>

            {/* Beschriftung + Eingabefeld */}
            <View style={{ gap: spacing.sm }}>
              <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>{label}</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={placeholder}
                placeholderTextColor={colors.textTertiary}
                autoFocus
                multiline={multiline}
                // Mehrzeilig macht die Eingabetaste zum Zeilenumbruch —
                // gespeichert wird dann nur über den Knopf.
                returnKeyType={multiline ? "default" : "done"}
                onSubmitEditing={multiline ? undefined : handleSubmit}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.background,
                  color: colors.text,
                  ...(multiline ? { minHeight: 88, textAlignVertical: "top" as const } : null),
                }}
              />
            </View>

            {/* Knöpfe: Abbrechen zurückhaltend, Speichern dominant */}
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <TouchableOpacity
                onPress={onCancel}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.medium,
                    color: colors.textSecondary,
                  }}
                >
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!isValid}
                activeOpacity={0.8}
                style={{
                  flex: 1.5,
                  paddingVertical: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: isValid ? colors.primary : colors.textTertiary,
                  alignItems: "center",
                  ...shadows.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: typography.bold,
                    color: colors.textInverse,
                  }}
                >
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
