import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { colors, radii, typography } from "@/shared/theme";

/**
 * Includes its own clear control. `clearButtonMode` only exists on iOS, and
 * Android is this app's shipping platform.
 */
export function SearchField({
  value,
  onChangeText,
  style,
  ...inputProps
}: Omit<TextInputProps, "style" | "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.shell, style]}>
      <Search color={colors.dim} size={17} strokeWidth={1.8} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.dim}
        selectionColor={colors.accent}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        {...inputProps}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel={t("common.clearInput")}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => onChangeText("")}
          style={styles.clear}
        >
          <X color={colors.textSecondary} size={13} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    paddingVertical: 10,
  },
  clear: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.surfacePressed,
  },
});
