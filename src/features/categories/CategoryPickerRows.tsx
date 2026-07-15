import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import { colors, radii } from "@/shared/theme";

export const CategoryRow = memo(function CategoryRow({
  id,
  label,
  active,
  onToggle,
}: {
  id: string;
  label: string;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={() => onToggle(id)}
      style={({ pressed }) => [
        styles.row,
        active && styles.rowActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
        <Text style={styles.code}>{id}</Text>
      </View>
      {active ? (
        <Check color={colors.text} size={18} strokeWidth={2.1} />
      ) : null}
    </Pressable>
  );
});

export const SelectedCategoryChip = memo(function SelectedCategoryChip({
  id,
  label,
  removeLabel,
  onRemove,
}: {
  id: string;
  label: string;
  removeLabel: string;
  onRemove: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={removeLabel}
      onPress={() => onRemove(id)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
      <X color={colors.muted} size={14} strokeWidth={1.8} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowActive: {
    backgroundColor: colors.surfacePressed,
    borderColor: colors.borderStrong,
  },
  rowCopy: { flex: 1, gap: 2 },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
  labelActive: { color: colors.text },
  code: { color: colors.dim, fontSize: 11 },
  chip: {
    maxWidth: 220,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  chipText: { flexShrink: 1, color: colors.textSecondary, fontSize: 13 },
  pressed: { opacity: 0.82 },
});
