/**
 * Deck-specific action sheet with all 8 menu items.
 * Used in the deck detail view (three-dot menu).
 */
import React from "react";
import {
  Download,
  Pencil,
  GraduationCap,
  FolderPlus,
  Copy,
  Share2,
  Info,
  Trash2,
} from "lucide-react-native";
import ActionSheet, { type ActionSheetItem } from "./ActionSheet";
import { useTranslation } from "react-i18next";

interface DeckActionSheetProps {
  visible: boolean;
  deckTitle: string;
  onClose: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onAddToCourse: () => void;
  onAddToFolder: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDetails: () => void;
  onDelete: () => void;
}

export default function DeckActionSheet({
  visible,
  deckTitle,
  onClose,
  onDownload,
  onEdit,
  onAddToCourse,
  onAddToFolder,
  onDuplicate,
  onShare,
  onDetails,
  onDelete,
}: DeckActionSheetProps) {
  const { t } = useTranslation();

  const items: ActionSheetItem[] = [
    {
      key: "download",
      label: t("deckMenu.download"),
      icon: Download,
      onPress: onDownload,
    },
    {
      key: "edit",
      label: t("deckMenu.edit"),
      icon: Pencil,
      onPress: onEdit,
    },
    {
      key: "addToCourse",
      label: t("deckMenu.addToCourse"),
      icon: GraduationCap,
      onPress: onAddToCourse,
    },
    {
      key: "addToFolder",
      label: t("deckMenu.addToFolder"),
      icon: FolderPlus,
      onPress: onAddToFolder,
    },
    {
      key: "duplicate",
      label: t("deckMenu.duplicate"),
      icon: Copy,
      onPress: onDuplicate,
    },
    {
      key: "share",
      label: t("deckMenu.share"),
      icon: Share2,
      onPress: onShare,
    },
    {
      key: "details",
      label: t("deckMenu.details"),
      icon: Info,
      onPress: onDetails,
    },
    {
      key: "delete",
      label: t("deckMenu.delete"),
      icon: Trash2,
      onPress: onDelete,
      destructive: true,
    },
  ];

  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      items={items}
      title={deckTitle}
    />
  );
}
