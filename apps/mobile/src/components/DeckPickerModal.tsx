/**
 * Modal to pick a deck and add it to the current folder — the mirror image of
 * FolderPickerModal (which picks a folder for a deck). Same layout on purpose,
 * so both directions feel like one feature.
 *
 * Why it exists: standing in an empty folder, the only hint was "add decks via
 * the three-dot menu in the deck" — pointing at a menu somewhere else, while the
 * folder's own menu could only rename and delete. The folder told you what to do
 * but could not do it.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Layers, Check } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import {
  listDecks,
  listDecksInFolder,
  addDeckToFolder,
  type Deck,
} from "../lib/api";

interface DeckPickerModalProps {
  visible: boolean;
  folderId: string;
  userId: string;
  onClose: () => void;
  onAdded: (deck: Deck) => void;
}

export default function DeckPickerModal({
  visible,
  folderId,
  userId,
  onClose,
  onAdded,
}: DeckPickerModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [decks, setDecks] = useState<Deck[]>([]);
  // Decks already in THIS folder — shown with a check and not tappable, so the
  // same deck can't be added twice. A deck may well sit in several folders
  // (Laras Entscheidung), so being in another folder does not disable it here.
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, inside] = await Promise.all([
        listDecks(userId),
        listDecksInFolder(folderId).catch(() => ({ decks: [] as Deck[] })),
      ]);
      setDecks(all.decks);
      setAlreadyIn(new Set(inside.decks.map((d) => d.id)));
    } catch {
      Alert.alert(t("common.error"), t("folder.deckLoadError"));
    } finally {
      setLoading(false);
    }
  }, [folderId, userId, t]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handleAdd = async (deck: Deck) => {
    setAdding(deck.id);
    try {
      await addDeckToFolder(folderId, deck.id);
      onAdded(deck);
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
        {/* Header — mirrors FolderPickerModal, minus "new": decks are created by
            scanning, not from here. */}
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
            {t("folder.selectDeck")}
          </Text>
          <View style={{ width: 64 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
            {decks.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: spacing.md }}>
                <Layers size={40} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: typography.base }}>
                  {t("folder.noDecks")}
                </Text>
              </View>
            ) : (
              decks.map((deck) => {
                const isIn = alreadyIn.has(deck.id);
                return (
                  <TouchableOpacity
                    key={deck.id}
                    onPress={() => handleAdd(deck)}
                    disabled={isIn || adding === deck.id}
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
                      opacity: isIn ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.primaryLight,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Layers size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}>
                        {deck.title}
                      </Text>
                      <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                        {isIn
                          ? t("folder.deckAlreadyIn")
                          : `${deck.cardCount ?? 0} ${
                              (deck.cardCount ?? 0) === 1 ? t("library.card") : t("library.cards")
                            }`}
                      </Text>
                    </View>
                    {adding === deck.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : isIn ? (
                      <Check size={18} color={colors.success} />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
