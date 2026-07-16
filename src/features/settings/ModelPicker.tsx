import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, radii } from "@/shared/theme";
import { searchModels, type ModelOption } from "./providerCore";

export function ModelPicker({
  models,
  selectedId,
  onSelect,
}: {
  models: ModelOption[];
  selectedId: string;
  onSelect: (modelId: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const visibleModels = useMemo(
    () => searchModels(models, query).slice(0, 50),
    [models, query],
  );

  if (models.length === 0) return null;

  return (
    <View style={styles.root}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("provider.searchModels")}
        placeholderTextColor={colors.dim}
        style={styles.input}
      />
      {visibleModels.map((model) => {
        const selected = model.id === selectedId;
        return (
          <Pressable
            key={model.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              styles.modelRow,
              selected && styles.modelRowSelected,
              pressed && styles.modelRowPressed,
            ]}
            onPress={() => onSelect(model.id)}
          >
            <View style={styles.modelMain}>
              <Text style={styles.modelName} numberOfLines={1}>
                {model.name}
                {model.free ? ` · ${t("provider.free")}` : ""}
              </Text>
              <Text style={styles.modelId} numberOfLines={1}>
                {model.id}
              </Text>
            </View>
            {selected ? (
              <Animated.View entering={FadeIn.duration(140)}>
                <Check color={colors.text} size={19} strokeWidth={2.2} />
              </Animated.View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 8 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 4,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modelRowSelected: { backgroundColor: colors.surfacePressed },
  modelRowPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  modelMain: { flex: 1 },
  modelName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  modelId: { color: colors.dim, fontSize: 12, marginTop: 3 },
});
