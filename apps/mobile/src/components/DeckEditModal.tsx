/**
 * Modal to edit deck metadata (title, tags, description).
 */
import React, { useEffect, useState } from "react";
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
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import { getDeckDetails, updateDeck } from "../lib/api";
import {
  SPEECH_LANGUAGES,
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

  useEffect(() => {
    if (!visible) return;
    setTitle(currentTitle);
    setTagsText(currentTags.join(", "));

    let cancelled = false;
    getDeckDetails(deckId)
      .then(({ details }) => {
        if (cancelled) return;
        setLangFront(toSpeechLanguage(details.speechLangFront));
        setLangBack(toSpeechLanguage(details.speechLangBack));
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
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateDeck(deckId, {
        title: title.trim(),
        tags,
        speechLangFront: langFront,
        speechLangBack: langBack,
      });
      onSaved(title.trim(), tags);
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

  /** Sprachwahl als Reihe von Chips — bei fünf Einträgen die kürzeste Geste. */
  const languageChips = (
    value: SpeechLanguage,
    onPick: (code: SpeechLanguage) => void
  ) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {SPEECH_LANGUAGES.map((lang) => {
        const active = lang.code === value;
        return (
          <TouchableOpacity
            key={lang.code}
            onPress={() => onPick(lang.code)}
            activeOpacity={0.7}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : colors.surface,
            }}
          >
            <Text
              style={{
                fontSize: typography.sm,
                fontWeight: active ? typography.semibold : typography.normal,
                color: active ? colors.textInverse : colors.text,
              }}
            >
              {lang.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
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
                onChangeText={setTagsText}
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
              {languageChips(langFront, setLangFront)}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={sectionLabelStyle}>Vorlesen: Rückseite</Text>
              {languageChips(langBack, setLangBack)}
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
