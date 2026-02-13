/**
 * Modal to display deck details (metadata, courses, folders, stats).
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  Calendar,
  CreditCard,
  GraduationCap,
  Folder,
  Clock,
  Tag,
} from "lucide-react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";
import { useTranslation } from "react-i18next";
import { getDeckDetails, type DeckDetails } from "../lib/api";

interface DeckDetailsModalProps {
  visible: boolean;
  deckId: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeckDetailsModal({
  visible,
  deckId,
  onClose,
}: DeckDetailsModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [details, setDetails] = useState<DeckDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadDetails();
    }
  }, [visible]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const { details: fetched } = await getDeckDetails(deckId);
      setDetails(fetched);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const DetailRow = ({
    icon: Icon,
    label,
    value,
    iconColor,
  }: {
    icon: typeof Calendar;
    label: string;
    value: string;
    iconColor?: string;
  }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surfaceSecondary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Icon size={16} color={iconColor ?? colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: typography.xs, color: colors.textTertiary, textTransform: "uppercase" }}>
          {label}
        </Text>
        <Text style={{ fontSize: typography.base, color: colors.text, fontWeight: typography.medium }}>
          {value}
        </Text>
      </View>
    </View>
  );

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
            <Text style={{ color: colors.textSecondary, fontSize: typography.base }}>{t("common.close")}</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: typography.bold, fontSize: typography.lg, color: colors.text }}>
            {t("deckDetails.title")}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : details ? (
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {/* Deck title card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginBottom: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                ...shadows.sm,
              }}
            >
              <Text
                style={{
                  fontSize: typography.xl,
                  fontWeight: typography.bold,
                  color: colors.text,
                  marginBottom: spacing.xs,
                }}
              >
                {details.title}
              </Text>
              {details.tags.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm }}>
                  {details.tags.map((tag, idx) => (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: colors.primaryLight,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={{ fontSize: typography.xs, color: colors.primary, fontWeight: typography.medium }}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Detail rows */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                ...shadows.sm,
              }}
            >
              <DetailRow
                icon={CreditCard}
                label={t("deckDetails.cardCount")}
                value={`${details.cardCount} ${details.cardCount === 1 ? t("deckDetails.card") : t("deckDetails.cards")}`}
                iconColor={colors.primary}
              />
              <DetailRow
                icon={Calendar}
                label={t("deckDetails.createdAt")}
                value={formatDate(details.createdAt)}
              />
              <DetailRow
                icon={Clock}
                label={t("deckDetails.updatedAt")}
                value={formatDate(details.updatedAt)}
              />
              <DetailRow
                icon={Tag}
                label={t("deckDetails.tagsCount")}
                value={details.tags.length > 0 ? details.tags.join(", ") : t("deckDetails.noTags")}
              />
              <DetailRow
                icon={GraduationCap}
                label={t("deckDetails.coursesLabel")}
                value={
                  details.courses.length > 0
                    ? details.courses.map((c) => c.title).join(", ")
                    : t("deckDetails.noCourses")
                }
                iconColor={colors.info}
              />
              <DetailRow
                icon={Folder}
                label={t("deckDetails.foldersLabel")}
                value={
                  details.folders.length > 0
                    ? details.folders.map((f) => f.title).join(", ")
                    : t("deckDetails.noFolders")
                }
                iconColor={colors.warning}
              />
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary }}>{t("deckDetails.loadError")}</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
