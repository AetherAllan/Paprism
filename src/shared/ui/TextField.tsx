import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, radii, typography } from "@/shared/theme";

export function TextField({
  label,
  editable,
  style,
  ...inputProps
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        editable={editable}
        placeholderTextColor={colors.dim}
        selectionColor={colors.accent}
        style={[styles.input, editable === false && styles.disabled, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { ...typography.caption, color: colors.muted, marginBottom: 7 },
  input: {
    ...typography.body,
    minHeight: 48,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  disabled: { color: colors.dim, backgroundColor: colors.surface },
});
