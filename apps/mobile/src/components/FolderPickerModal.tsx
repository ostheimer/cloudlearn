/**
 * Modal to select or create a folder and add the current deck to it.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Folder as FolderIcon, Check } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import {
  listFolders,
  createFolder,
  addDeckToFolder,
  type Folder,
} from "../lib/api";

interface FolderPickerModalProps {
  visible: boolean;
  deckId: string;
  onClose: () => void;
  onAdded: (folder: Folder) => void;
}

export default function FolderPickerModal({
  visible,
  deckId,
  onClose,
  onAdded,
}: FolderPickerModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const { folders: fetched } = await listFolders();
      setFolders(fetched);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newTitle.trim()) return;
    try {
      const { folder } = await createFolder(newTitle.trim());
      setFolders((prev) => [folder, ...prev]);
      setNewTitle("");
      setCreating(false);
      // Auto-add deck to the new folder
      await handleAddToFolder(folder);
    } catch {
      Alert.alert(t("common.error"), t("folder.createError"));
    }
  };

  const handleAddToFolder = async (folder: Folder) => {
    setAdding(folder.id);
    try {
      await addDeckToFolder(folder.id, deckId);
      onAdded(folder);
      onClose();
    } catch {
      Alert.alert(t("common.error"), t("folder.addError"));
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
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
          <TouchableOpacity onPress={onClose} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <X size={18} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: typography.base }}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: typography.bold, fontSize: typography.lg, color: colors.text }}>
            {t("folder.select")}
          </Text>
          <TouchableOpacity
            onPress={() => setCreating(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
          >
            <Plus size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: typography.base, fontWeight: typography.semibold }}>
              {t("common.new")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Create new folder inline */}
        {creating && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
              gap: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t("folder.titlePlaceholder")}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: typography.base,
                backgroundColor: colors.surface,
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPress={handleCreateFolder}
              disabled={!newTitle.trim()}
              style={{
                backgroundColor: newTitle.trim() ? colors.primary : colors.textTertiary,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <Check size={18} color={colors.textInverse} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCreating(false); setNewTitle(""); }}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Folder list */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
            {folders.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: spacing.md }}>
                <FolderIcon size={40} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: typography.base }}>
                  {t("folder.empty")}
                </Text>
              </View>
            ) : (
              folders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  onPress={() => handleAddToFolder(folder)}
                  disabled={adding === folder.id}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.lg,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: folder.color ?? colors.warningLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <FolderIcon size={18} color={folder.color ? colors.textInverse : colors.warning} />
                  </View>
                  <Text style={{ flex: 1, fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}>
                    {folder.title}
                  </Text>
                  {adding === folder.id && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
