import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import { colors, radii, surfaces, typography } from "@/shared/theme";
import { PressableScale } from "@/shared/ui/PressableScale";

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
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={() => onToggle(id)}
      scaleTo={0.985}
      style={[surfaces.card, styles.row, active && styles.rowActive]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
        <Text style={styles.code}>{id}</Text>
      </View>
      <View style={[styles.check, active && styles.checkActive]}>
        {active ? (
          <Check color={colors.inverse} size={13} strokeWidth={3} />
        ) : null}
      </View>
    </PressableScale>
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
    <PressableScale
      accessibilityLabel={removeLabel}
      onPress={() => onRemove(id)}
      scaleTo={0.96}
      style={styles.chip}
    >
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
      <X color={colors.muted} size={13} strokeWidth={2} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radii.medium,
  },
  rowActive: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accentBorder,
  },
  rowCopy: { flex: 1, gap: 2 },
  label: { ...typography.label, color: colors.textSecondary },
  labelActive: { color: colors.text },
  code: { ...typography.caption, color: colors.dim },
  check: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.surfacePressed,
  },
  checkActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chip: {
    maxWidth: 220,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  chipText: {
    ...typography.caption,
    fontSize: 13,
    flexShrink: 1,
    color: colors.textSecondary,
  },
});
