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
import { updateDeck } from "../lib/api";

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

  useEffect(() => {
    if (visible) {
      setTitle(currentTitle);
      setTagsText(currentTags.join(", "));
    }
  }, [visible, currentTitle, currentTags]);

  const isValid = title.trim().length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateDeck(deckId, { title: title.trim(), tags });
      onSaved(title.trim(), tags);
      onClose();
    } catch {
      Alert.alert(t("common.error"), t("deckEdit.saveError"));
    } finally {
      setSaving(false);
    }
  };

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
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
