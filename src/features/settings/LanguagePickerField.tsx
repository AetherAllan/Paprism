import { StyleSheet, Text, View } from "react-native";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import Languages from "lucide-react-native/icons/languages";
import { colors, radii, surfaces, typography } from "@/shared/theme";
import { PressableScale } from "@/shared/ui/PressableScale";
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
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      style={[surfaces.card, styles.field]}
    >
      <View style={[surfaces.control, styles.icon]}>
        <Languages color={colors.text} size={18} strokeWidth={1.7} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{selected?.label}</Text>
        {selected?.detail ? (
          <Text style={styles.detail}>{selected.detail}</Text>
        ) : null}
      </View>
      <ChevronDown color={colors.dim} size={18} strokeWidth={1.7} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    padding: 11,
    paddingRight: 15,
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.small,
  },
  copy: { flex: 1, gap: 1 },
  label: { ...typography.label, fontSize: 15, color: colors.text },
  detail: { ...typography.caption, color: colors.dim },
});
