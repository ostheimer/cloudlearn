/**
 * Modal to pick decks and add them to the current folder — the mirror image of
 * FolderPickerModal (which picks a folder for a deck). Same layout on purpose,
 * so both directions feel like one feature.
 *
 * Mehrfachauswahl mit sichtbarer Reihenfolge (Laras Wunsch, 22.07.): Antippen
 * vergibt Nummern in Antipp-Reihenfolge, erst der Knopf unten speichert. Die
 * Decks landen in genau dieser Reihenfolge HINTER dem, was schon im Ordner
 * liegt — gespeichert wird dafür nacheinander, denn die Ordner-Sortierung
 * liest `position nulls last, added_at asc`: die Einfüge-Zeitpunkte SIND die
 * Reihenfolge, ganz ohne zweiten Schreibweg.
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
import { toggleSelection } from "../lib/deckSelection";

interface DeckPickerModalProps {
  visible: boolean;
  folderId: string;
  userId: string;
  onClose: () => void;
  /**
   * Nach JEDEM erfolgreichen Hinzufügen (auch teilweisem) — der Bildschirm
   * lädt damit seine Liste nach. Kein Erfolgs-Alert mehr: dass die Decks im
   * Ordner liegen, sieht man direkt in der Liste.
   */
  onAdded: (decks: Deck[]) => void;
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
  // Antipp-Reihenfolge; Position im Array = angezeigte Nummer − 1.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
    if (visible) {
      setSelectedIds([]);
      void load();
    }
  }, [visible, load]);

  const handleConfirm = async () => {
    setBusy(true);
    const added: Deck[] = [];
    try {
      // Nacheinander statt parallel — die Einfüge-Reihenfolge ist hier die
      // Zusage an die Nutzerin (siehe Kopfkommentar).
      for (const deckId of selectedIds) {
        const deck = decks.find((d) => d.id === deckId);
        if (!deck) continue;
        await addDeckToFolder(folderId, deckId);
        added.push(deck);
      }
      onAdded(added);
      onClose();
    } catch {
      // Die schon gelungenen liegen im Ordner — Bildschirm nachladen lassen,
      // gelungene aus der Auswahl nehmen, Fenster offen lassen: die Nutzerin
      // sieht so genau, welche noch fehlen, und kann es erneut versuchen.
      if (added.length > 0) onAdded(added);
      setSelectedIds((prev) => prev.filter((id) => !added.some((d) => d.id === id)));
      Alert.alert(t("common.error"), t("folder.addError"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const confirmLabel =
    selectedIds.length === 1
      ? t("folder.addSelectedOne")
      : t("folder.addSelectedMany", { count: selectedIds.length });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android-Zurueck-Taste schliesst das Fenster (#608) — vorher tat sie nichts.
      onRequestClose={onClose}
    >
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
                // Position in der Antipp-Reihenfolge; −1 = nicht ausgewählt.
                const order = selectedIds.indexOf(deck.id);
                const isSelected = order >= 0;
                return (
                  <TouchableOpacity
                    key={deck.id}
                    onPress={() => setSelectedIds((prev) => toggleSelection(prev, deck.id))}
                    disabled={isIn || busy}
                    activeOpacity={0.7}
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: spacing.lg,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.primary : colors.border,
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
                    {isIn ? (
                      <Check size={18} color={colors.success} />
                    ) : isSelected ? (
                      // Die Nummer zeigt die Antipp-Reihenfolge — und damit die
                      // Reihenfolge, in der die Decks im Ordner landen.
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: colors.primary,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textInverse,
                            fontSize: typography.sm,
                            fontWeight: typography.bold,
                          }}
                        >
                          {order + 1}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          borderWidth: 1.5,
                          borderColor: colors.border,
                        }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Bestätigen erst hier — Antippen allein speichert nichts mehr. */}
        {!loading && selectedIds.length > 0 && (
          <View
            style={{
              padding: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={busy}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                alignItems: "center",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text
                  style={{
                    color: colors.textInverse,
                    fontWeight: typography.bold,
                    fontSize: typography.base,
                  }}
                >
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
