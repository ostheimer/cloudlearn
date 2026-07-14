import { Text, TouchableOpacity, View } from "react-native";
import { useColors, spacing, radius, typography, shadows } from "../theme";

// Which subset of a deck's cards a learning mode should study.
//   all     — every usable card (the default)
//   starred — only cards the learner flagged (card.starred === true)
//   wobbly  — only the deck's most-often-wrong cards (from deck stats)
export type CardSource = "all" | "starred" | "wobbly";

/**
 * Filter a card list down to the chosen source.
 *
 * Pure helper (no React / theme) so it can be unit-tested directly. `wobblyIds`
 * is the set of the deck's wobbly card ids (see fetchDeckStats → wobblyCards);
 * pass an empty set when stats are unavailable and "wobbly" simply yields none.
 */
export function filterBySource<T extends { id: string; starred?: boolean }>(
  cards: T[],
  source: CardSource,
  wobblyIds: Set<string>
): T[] {
  if (source === "starred") return cards.filter((c) => c.starred === true);
  if (source === "wobbly") return cards.filter((c) => wobblyIds.has(c.id));
  return cards;
}

interface CardSourcePickerProps {
  value: CardSource;
  onChange: (source: CardSource) => void;
  allCount: number;
  starredCount: number;
  wobblyCount: number;
}

/**
 * Shared "Kartenquelle" picker: three radio-style rows letting the learner pick
 * which cards a mode studies. The starred / wobbly rows are disabled and dimmed
 * when their count is 0. Styling mirrors the setup cards used across the modes.
 */
export function CardSourcePicker({
  value,
  onChange,
  allCount,
  starredCount,
  wobblyCount,
}: CardSourcePickerProps) {
  const colors = useColors();

  const rows: { key: CardSource; label: string; count: number; disabled: boolean }[] = [
    { key: "all", label: "Alle Karten", count: allCount, disabled: allCount === 0 },
    {
      key: "starred",
      label: "Nur markierte",
      count: starredCount,
      disabled: starredCount === 0,
    },
    {
      key: "wobbly",
      label: "Nur Wackelkandidaten",
      count: wobblyCount,
      disabled: wobblyCount === 0,
    },
  ];

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
        ...shadows.sm,
      }}
    >
      <Text
        style={{
          fontSize: typography.sm,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        }}
      >
        Kartenquelle
      </Text>

      {rows.map((row) => {
        const active = value === row.key;
        return (
          <TouchableOpacity
            key={row.key}
            onPress={() => {
              if (!row.disabled) onChange(row.key);
            }}
            disabled={row.disabled}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: row.disabled }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primaryLight : colors.surface,
              opacity: row.disabled ? 0.4 : 1,
            }}
          >
            {/* Drawn radio indicator (outer ring + inner dot when active) */}
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: active ? colors.primary : colors.textTertiary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {active && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>

            <Text
              style={{
                flex: 1,
                fontSize: typography.base,
                fontWeight: active ? typography.semibold : typography.normal,
                color: active ? colors.primary : colors.text,
              }}
            >
              {row.label}
            </Text>

            <Text
              style={{
                fontSize: typography.sm,
                fontWeight: typography.semibold,
                color: active ? colors.primary : colors.textSecondary,
              }}
            >
              ({row.count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
