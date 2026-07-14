import { Pressable, StyleSheet, Text, View } from "react-native";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import Languages from "lucide-react-native/icons/languages";
import { colors, radii } from "@/shared/theme";
import type { LanguageOption } from "./languagePicker";

export function LanguagePickerField({
  value,
  options,
  onPress,
}: {
  value: string;
  options: LanguageOption[];
  onPress: () => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Languages color={colors.text} size={19} strokeWidth={1.8} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{selected?.label}</Text>
        {selected?.detail ? (
          <Text style={styles.detail}>{selected.detail}</Text>
        ) : null}
      </View>
      <ChevronDown color={colors.dim} size={19} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    padding: 10,
    paddingRight: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.medium,
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.small,
    backgroundColor: colors.surfaceRaised,
  },
  copy: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 15, fontWeight: "500" },
  detail: { color: colors.dim, fontSize: 12 },
  pressed: { opacity: 0.82 },
});
