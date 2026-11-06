import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii, surfaces, typography } from "@/shared/theme";
import { PressableScale } from "./PressableScale";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const CONTENT_COLOR: Record<ButtonVariant, string> = {
  primary: colors.inverse,
  secondary: colors.textSecondary,
  ghost: colors.muted,
  danger: colors.danger,
};

export function Button({
  label,
  icon: Icon,
  iconColor,
  variant = "secondary",
  size = "medium",
  loading = false,
  disabled = false,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  icon?: LucideIcon;
  /** Overrides the icon only, e.g. to show an "on" state in the signal colour. */
  iconColor?: string;
  variant?: ButtonVariant;
  size?: "medium" | "small";
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const color = CONTENT_COLOR[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.base,
        size === "small" ? styles.small : styles.medium,
        variant === "primary" && styles.primary,
        variant === "secondary" && surfaces.control,
        variant === "danger" && styles.danger,
        size === "small" && variant === "secondary" && styles.smallRadius,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : Icon ? (
        <Icon
          color={iconColor ?? color}
          size={size === "small" ? 15 : 17}
          strokeWidth={1.8}
        />
      ) : null}
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={[
          styles.label,
          size === "small" && styles.labelSmall,
          variant === "primary" && styles.labelPrimary,
          { color },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
  },
  medium: { minHeight: 50, borderRadius: radii.large - 2 },
  small: { minHeight: 40, borderRadius: radii.medium - 2 },
  smallRadius: { borderRadius: radii.medium - 2 },
  primary: { backgroundColor: colors.text },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dangerBorder,
  },
  disabled: { opacity: 0.4 },
  label: { ...typography.label, flexShrink: 1 },
  labelSmall: { fontSize: 13, lineHeight: 18 },
  labelPrimary: { fontWeight: "600" },
});
