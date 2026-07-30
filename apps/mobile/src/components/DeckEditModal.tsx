/**
 * Modal to edit deck metadata (title, tags, description).
 */
import React, { useEffect, useRef, useState } from "react";
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
import { X, Check, ChevronDown, ChevronUp } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import { getDeckDetails, updateDeck } from "../lib/api";
import { buildDeckUpdatePayload } from "../lib/deckEditPayload";
import { TITLE_MAX_LENGTH } from "../lib/titleLimit";
import {
  SPEECH_LANGUAGES,
  speechLanguageLabel,
  toSpeechLanguage,
  type SpeechLanguage,
} from "../lib/speechLanguages";

interface DeckEditModalProps {
  visible: boolean;
  deckId: string;
  currentTitle: string;
  currentTags: string[];
  onClose: () => void;
  onSaved: (title: string, tags: string[]) => void;
}

export default function DeckEditModal({
  visible,
  deckId,
  currentTitle,
  currentTags,
  onClose,
  onSaved,
}: DeckEditModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [title, setTitle] = useState(currentTitle);
  const [tagsText, setTagsText] = useState(currentTags.join(", "));
  const [saving, setSaving] = useState(false);
  // Die gespeicherten Sprachen kennt der aufrufende Bildschirm nicht (er hält
  // nur Titel und Schlagwörter), deshalb holt das Fenster sie sich beim Öffnen
  // selbst. Das kostet genau dann eine Anfrage, wenn jemand wirklich bearbeitet.
  const [langFront, setLangFront] = useState<SpeechLanguage>("de-DE");
  const [langBack, setLangBack] = useState<SpeechLanguage>("de-DE");
  // Welche Sprachliste gerade aufgeklappt ist — immer höchstens eine.
  const [openPicker, setOpenPicker] = useState<"front" | "back" | null>(null);
  // Refs statt State, weil die Werte nichts anzeigen: Sie entscheiden nur beim
  // Speichern, welche Felder mitgehen (#606). Ungeladene oder unangetastete
  // Felder werden weggelassen, sonst löscht ein leerer Startwert echte Daten.
  const detailsLoadedRef = useRef(false);
  const tagsEditedRef = useRef(false);
  const langFrontEditedRef = useRef(false);
  const langBackEditedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(currentTitle);
    setTagsText(currentTags.join(", "));
    detailsLoadedRef.current = false;
    tagsEditedRef.current = false;
    langFrontEditedRef.current = false;
    langBackEditedRef.current = false;

    let cancelled = false;
    getDeckDetails(deckId)
      .then(({ details }) => {
        if (cancelled) return;
        detailsLoadedRef.current = true;
        setLangFront(toSpeechLanguage(details.speechLangFront));
        setLangBack(toSpeechLanguage(details.speechLangBack));
        // Der aufrufende Bildschirm kennt die Schlagwörter nicht (sein Wert
        // startet leer, #606) — erst diese Antwort zeigt die echten. Eigene
        // Eingabe gewinnt, falls schon vor der Antwort getippt wurde.
        if (!tagsEditedRef.current) {
          setTagsText(details.tags.join(", "));
        }
      })
      .catch(() => {
        /* Sprachen bleiben auf Deutsch stehen — Bearbeiten muss trotzdem gehen */
      });
    return () => {
      cancelled = true;
    };
  }, [visible, currentTitle, currentTags, deckId]);

  const isValid = title.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = buildDeckUpdatePayload({
        title,
        tagsText,
        tagsEdited: tagsEditedRef.current,
        langFront,
        langFrontEdited: langFrontEditedRef.current,
        langBack,
        langBackEdited: langBackEditedRef.current,
        detailsLoaded: detailsLoadedRef.current,
      });
      await updateDeck(deckId, payload);
      // Ohne mitgeschickte Tags hat der Server nichts geändert — dann behält
      // der Bildschirm dahinter seinen bisherigen Stand.
      onSaved(payload.title, payload.tags ?? currentTags);
      onClose();
    } catch {
      Alert.alert(t("common.error"), t("deckEdit.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const sectionLabelStyle = {
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    fontSize: typography.sm,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  };

  /**
   * Sprachwahl als aufklappbare Zeile statt als Chips: Bei 24 Sprachen mal zwei
   * Seiten wären Chips eine Kachel-Wand, durch die man erst suchen müsste.
   * Zugeklappt steht die gewählte Sprache da — der Normalfall braucht also gar
   * keine Geste. Es ist immer nur eine Liste offen, damit das Fenster nicht auf
   * die doppelte Länge springt.
   */
  const languagePicker = (
    which: "front" | "back",
    value: SpeechLanguage,
    onPick: (code: SpeechLanguage) => void
  ) => {
    const open = openPicker === which;
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        <TouchableOpacity
          onPress={() => setOpenPicker(open ? null : which)}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
          }}
        >
          <Text style={{ fontSize: typography.base, color: colors.text }}>
            {speechLanguageLabel(value)}
          </Text>
          {open ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {open &&
          SPEECH_LANGUAGES.map((lang) => {
            const active = lang.code === value;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => {
                  onPick(lang.code);
                  setOpenPicker(null);
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderLight,
                  backgroundColor: active ? colors.primaryLight : colors.surface,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.base,
                    fontWeight: active ? typography.semibold : typography.normal,
                    color: active ? colors.primary : colors.text,
                  }}
                >
                  {lang.label}
                </Text>
                {active && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android-Zurueck-Taste schliesst das Fenster (#608) — vorher tat sie nichts.
      onRequestClose={onClose}
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
              onPress={onClose}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
            >
              <X size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: typography.base }}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontWeight: typography.bold, fontSize: typography.lg, color: colors.text }}>
              {t("deckEdit.title")}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isValid || saving}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
            >
              <Check size={18} color={isValid ? colors.primary : colors.textTertiary} />
              <Text
                style={{
                  color: isValid ? colors.primary : colors.textTertiary,
                  fontSize: typography.base,
                  fontWeight: typography.bold,
                }}
              >
                {t("common.save")}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            {/* Title */}
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
                {t("deckEdit.deckTitle")}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("deckEdit.titlePlaceholder")}
                placeholderTextColor={colors.textTertiary}
                // Servergrenze für Deck-Titel (#612) — Tipp-Stopp statt
                // Fehler beim Speichern.
                maxLength={TITLE_MAX_LENGTH}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  color: colors.text,
                }}
              />
            </View>

            {/* Tags */}
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
                {t("deckEdit.tags")}
              </Text>
              <TextInput
                value={tagsText}
                onChangeText={(text) => {
                  tagsEditedRef.current = true;
                  setTagsText(text);
                }}
                placeholder={t("deckEdit.tagsPlaceholder")}
                placeholderTextColor={colors.textTertiary}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 14,
                  fontSize: typography.base,
                  backgroundColor: colors.surface,
                  color: colors.text,
                }}
              />
              <Text style={{ color: colors.textTertiary, fontSize: typography.xs }}>
                {t("deckEdit.tagsHint")}
              </Text>
            </View>

            {/* Vorlese-Sprachen (#571). Getrennt nach Seite, weil Vokabelkarten
                zweisprachig sind: vorne „les données", hinten „die Daten" —
                eine Sprache fürs ganze Deck würde eine der beiden Seiten immer
                falsch aussprechen. */}
            <View style={{ gap: spacing.sm }}>
              <Text style={sectionLabelStyle}>Vorlesen: Vorderseite</Text>
              {languagePicker("front", langFront, (code) => {
                langFrontEditedRef.current = true;
                setLangFront(code);
              })}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={sectionLabelStyle}>Vorlesen: Rückseite</Text>
              {languagePicker("back", langBack, (code) => {
                langBackEditedRef.current = true;
                setLangBack(code);
              })}
              <Text style={{ color: colors.textTertiary, fontSize: typography.xs }}>
                Bestimmt, in welcher Sprache der Lautsprecher die jeweilige Seite
                vorliest. Bei Vokabeln also vorne die Fremdsprache, hinten Deutsch.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
