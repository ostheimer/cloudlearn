/**
 * Reusable bottom-sheet action menu component.
 * Wraps @gorhom/bottom-sheet with themed styling and dark mode support.
 */
import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useColors } from "../theme";
import { spacing, radius, typography } from "../theme";
import type { LucideIcon } from "lucide-react-native";

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
  title?: string;
}

export default function ActionSheet({ visible, onClose, items, title }: ActionSheetProps) {
  const colors = useColors();
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Calculate snap point based on number of items
  const snapPoints = useMemo(() => {
    const headerHeight = title ? 56 : 16;
    const itemHeight = 56;
    const bottomPadding = 40;
    const totalHeight = headerHeight + items.length * itemHeight + bottomPadding;
    return [totalHeight];
  }, [items.length, title]);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
      }}
      handleIndicatorStyle={{
        backgroundColor: colors.textTertiary,
        width: 40,
      }}
    >
      <BottomSheetView style={{ paddingHorizontal: spacing.lg }}>
        {title && (
          <Text
            style={{
              fontSize: typography.lg,
              fontWeight: typography.bold,
              color: colors.text,
              paddingBottom: spacing.md,
              paddingTop: spacing.xs,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
        )}
        {items.map((item) => {
          const IconComponent = item.icon;
          const textColor = item.destructive
            ? colors.error
            : item.disabled
              ? colors.textTertiary
              : colors.text;
          const iconColor = item.destructive
            ? colors.error
            : item.disabled
              ? colors.textTertiary
              : colors.textSecondary;

          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                if (!item.disabled) {
                  onClose();
                  // Small delay to allow bottom sheet to close before action
                  setTimeout(item.onPress, 200);
                }
              }}
              disabled={item.disabled}
              activeOpacity={0.6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                gap: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              {IconComponent && (
                <View
                  style={{
                    width: 32,
                    alignItems: "center",
                  }}
                >
                  <IconComponent size={20} color={iconColor} />
                </View>
              )}
              <Text
                style={{
                  flex: 1,
                  fontSize: typography.base,
                  fontWeight: item.destructive ? typography.semibold : typography.medium,
                  color: textColor,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BottomSheetView>
    </BottomSheet>
  );
}
