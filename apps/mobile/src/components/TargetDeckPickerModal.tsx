/**
 * Ziel-Deck wählen — ein Deck antippen, fertig (Scan: „Zu Deck hinzufügen",
 * #612, erfüllt zugleich #571-Teil-C „alle Decks als Ziel").
 *
 * Ersetzt den Alert mit höchstens 8 Deck-Knöpfen (auf Android real oft nur
 * 2–3, ohne Scrollen, ohne Suche): Deck Nr. 9+ war als Ziel schlicht
 * unerreichbar. Layout wie DeckPickerModal/FolderPickerModal, damit alle
 * Auswahl-Fenster gleich aussehen — aber Einzelauswahl: Antippen wählt,
 * die Platz-Nachfragen danach (confirmSaveToDeck) bleiben beim Aufrufer.
 *
 * Volle Decks sind ausgegraut und nicht antippbar — vorher erfuhr man erst
 * NACH dem Antippen per Alert, dass kein Platz mehr ist. Bei unbekannter
 * Grenze (#603) wird nie gesperrt; die echte Grenze hält der Server.
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Layers, Plus, Search } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import type { Deck } from "../lib/api";
import { deckSlotsHint, freeCardSlots } from "../lib/importLimits";
import { PICKER_SEARCH_THRESHOLD, filterByTitle } from "../lib/pickerSearch";

interface TargetDeckPickerModalProps {
  visible: boolean;
  /** Überschrift-Zusatz: wie viele Karten gleich hinzugefügt würden. */
  cardCount: number;
  decks: Deck[];
  /** Karten-Grenze des Tarifs; `null` = unbekannt, dann wird nie gesperrt (#603). */
  maxCardsPerDeck: number | null;
  canCreateDeck: boolean;
  onClose: () => void;
  onCreateDeck: () => void;
  onSelect: (deck: Deck) => void;
}

export default function TargetDeckPickerModal({
  visible,
  cardCount,
  decks,
  maxCardsPerDeck,
  canCreateDeck,
  onClose,
  onCreateDeck,
  onSelect,
}: TargetDeckPickerModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  const shownDecks = filterByTitle(decks, search);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Android-Zurueck-Taste schliesst das Fenster (#608).
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Kopfzeile — wie DeckPickerModal. „Neu" bleibt hier erreichbar,
            falls alle vorhandenen Decks voll sind (#701). */}
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
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: typography.bold, fontSize: typography.lg, color: colors.text }}>
              {t("scanSave.pickDeck")}
            </Text>
            <Text style={{ fontSize: typography.xs, color: colors.textSecondary }}>
              {cardCount === 1
                ? t("scanSave.addCountOne")
                : t("scanSave.addCountMany", { count: cardCount })}
            </Text>
          </View>
          {canCreateDeck ? (
            <TouchableOpacity
              onPress={onCreateDeck}
              accessibilityRole="button"
              accessibilityLabel="Neues Deck"
              style={{ width: 64, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 3 }}
            >
              <Plus size={17} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: typography.base, fontWeight: typography.medium }}>
                Neu
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>

        {/* Suchfeld erst ab mehreren Decks (#612) — darunter nur Rauschen. */}
        {decks.length >= PICKER_SEARCH_THRESHOLD && (
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
              placeholder={t("folder.searchDecksPlaceholder")}
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, paddingVertical: spacing.md, fontSize: typography.base, color: colors.text }}
            />
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          {shownDecks.length === 0 ? (
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: typography.base,
                paddingTop: 40,
              }}
            >
              {t("folder.searchDecksEmpty")}
            </Text>
          ) : (
            shownDecks.map((deck) => {
              const free = freeCardSlots(deck, maxCardsPerDeck);
              const isFull = free !== null && free <= 0;
              const hint = deckSlotsHint(free);
              const count = deck.cardCount ?? 0;
              const countLabel = `${count} ${count === 1 ? t("library.card") : t("library.cards")}`;
              return (
                <TouchableOpacity
                  key={deck.id}
                  onPress={() => onSelect(deck)}
                  disabled={isFull}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isFull }}
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
                    opacity: isFull ? 0.55 : 1,
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
                    {/* Einzeilig (#612): ein Monster-Titel kürzt die Zeile,
                        nicht das Fenster. */}
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}
                    >
                      {deck.title}
                    </Text>
                    <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                      {hint ? `${countLabel} · ${hint}` : countLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
