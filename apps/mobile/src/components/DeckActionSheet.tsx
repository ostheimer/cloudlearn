/**
 * Deck-specific action sheet with all menu items.
 * Used in the deck detail view (three-dot menu).
 */
import React from "react";
import {
  Download,
  Pencil,
  FolderPlus,
  Copy,
  Share2,
  Link2Off,
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
  onAddToFolder: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onRevokeShare: () => void;
  onDetails: () => void;
  onDelete: () => void;
}

export default function DeckActionSheet({
  visible,
  deckTitle,
  onClose,
  onDownload,
  onEdit,
  onAddToFolder,
  onDuplicate,
  onShare,
  onRevokeShare,
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
      key: "revokeShare",
      label: t("deckMenu.revokeShare"),
      icon: Link2Off,
      onPress: onRevokeShare,
      destructive: true,
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
