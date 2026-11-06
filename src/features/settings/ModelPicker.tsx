import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, radii, typography } from "@/shared/theme";
import { PressableScale } from "@/shared/ui/PressableScale";
import { SearchField } from "@/shared/ui/SearchField";
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
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t("provider.searchModels")}
        style={styles.search}
      />
      {visibleModels.map((model) => {
        const selected = model.id === selectedId;
        return (
          <PressableScale
            key={model.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onSelect(model.id)}
            scaleTo={0.985}
            style={[styles.modelRow, selected && styles.modelRowSelected]}
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
                <Check color={colors.accent} size={18} strokeWidth={2.2} />
              </Animated.View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 4 },
  search: { marginBottom: 6 },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.small,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modelRowSelected: { backgroundColor: colors.surfaceRaised },
  modelMain: { flex: 1 },
  modelName: { ...typography.label, color: colors.text },
  modelId: { ...typography.caption, color: colors.dim, marginTop: 2 },
});
