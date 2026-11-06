import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii, surfaces } from "@/shared/theme";
import { PressableScale } from "./PressableScale";

export function IconButton({
  icon: Icon,
  label,
  onPress,
  size = 44,
  iconSize = 20,
  color = colors.text,
  active = false,
  plain = false,
  badge = false,
  disabled = false,
  hint,
  style,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  active?: boolean;
  /** Icon without a surface, for use inside an existing control. */
  plain?: boolean;
  badge?: boolean;
  disabled?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      hitSlop={size < 44 ? (44 - size) / 2 : undefined}
      onPress={onPress}
      scaleTo={0.92}
      style={[
        styles.base,
        { width: size, height: size },
        !plain && surfaces.control,
        !plain && size < 40 && styles.compact,
        active && styles.active,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon
        color={active ? colors.accent : color}
        size={iconSize}
        strokeWidth={1.7}
      />
      {badge ? <View style={styles.badge} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
  },
  compact: { borderRadius: radii.small },
  active: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  disabled: { opacity: 0.35 },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    boxShadow: `0 0 8px ${colors.accent}`,
  },
});
