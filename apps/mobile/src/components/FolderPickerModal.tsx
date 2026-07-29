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
import { X, Plus, Folder as FolderIcon, Check, Search } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import {
  listFolders,
  createFolder,
  addDeckToFolder,
  type Folder,
} from "../lib/api";
import { PICKER_SEARCH_THRESHOLD, filterByTitle } from "../lib/pickerSearch";

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
  // Netzfehler getrennt von "wirklich keine Ordner" (#612): vorher zeigte ein
  // Verbindungsfehler dieselbe "Noch keine Ordner"-Leere wie ein neues Konto.
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSearch("");
      loadFolders();
    }
  }, [visible]);

  const loadFolders = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { folders: fetched } = await listFolders();
      setFolders(fetched);
    } catch {
      setLoadError(true);
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

  const shownFolders = filterByTitle(folders, search);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android-Zurueck-Taste schliesst das Fenster (#608) — vorher tat sie nichts.
      onRequestClose={onClose}
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

        {/* Suchfeld erst ab mehreren Ordnern (#612) — darunter nur Rauschen. */}
        {!loading && !loadError && folders.length >= PICKER_SEARCH_THRESHOLD && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              paddingHorizontal: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            }}
          >
            <Search size={16} color={colors.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("folder.searchPlaceholder")}
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, paddingVertical: spacing.md, fontSize: typography.base, color: colors.text }}
            />
          </View>
        )}

        {/* Folder list */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={{ alignItems: "center", paddingTop: 40, gap: spacing.md, padding: spacing.lg }}>
            <FolderIcon size={40} color={colors.textTertiary} />
            <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: typography.base }}>
              {t("folder.loadError")}
            </Text>
            <TouchableOpacity
              onPress={() => void loadFolders()}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: typography.base, fontWeight: typography.medium }}>
                {t("common.retry")}
              </Text>
            </TouchableOpacity>
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
            ) : shownFolders.length === 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: "center",
                  fontSize: typography.base,
                  paddingTop: 40,
                }}
              >
                {t("folder.searchEmpty")}
              </Text>
            ) : (
              shownFolders.map((folder) => (
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
                  {/* Einzeilig (#612): ein Monster-Titel soll die Zeile kürzen,
                      nicht das Fenster sprengen. */}
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}
                  >
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
