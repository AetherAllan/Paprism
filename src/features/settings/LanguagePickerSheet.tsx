import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import { useTranslation } from "react-i18next";
import { colors, radii, surfaces, typography } from "@/shared/theme";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { PressableScale } from "@/shared/ui/PressableScale";
import { SearchField } from "@/shared/ui/SearchField";
import { filterLanguageOptions, type LanguageOption } from "./languagePicker";

type Props = {
  visible: boolean;
  title: string;
  value: string;
  options: LanguageOption[];
  searchable?: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function LanguagePickerSheet({
  visible,
  title,
  value,
  options,
  searchable = false,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const closing = useRef(false);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    setQuery("");
  }, [visible]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;

    if (!Keyboard.isVisible()) {
      onClose();
      return;
    }

    // Android otherwise runs the IME and sheet animations together, which can
    // leave a half-dismissed sheet visible for one frame sequence.
    let finished = false;
    let fallback: ReturnType<typeof setTimeout>;
    const subscription = Keyboard.addListener("keyboardDidHide", finish);
    function finish() {
      if (finished) return;
      finished = true;
      subscription.remove();
      clearTimeout(fallback);
      onClose();
    }
    fallback = setTimeout(finish, 350);
    Keyboard.dismiss();
  }, [onClose]);

  const filtered = useMemo(
    () => filterLanguageOptions(options, query),
    [options, query],
  );

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onClose={requestClose}
      maxHeight="82%"
    >
      {searchable ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("settings.searchLanguage")}
          style={styles.search}
        />
      ) : null}

      <FlatList
        data={filtered}
        style={styles.options}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const active = item.id === value;
          return (
            <PressableScale
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                onSelect(item.id);
                requestClose();
              }}
              scaleTo={0.985}
              style={[surfaces.card, styles.row, active && styles.active]}
            >
              <View style={styles.copy}>
                <Text style={styles.label}>{item.label}</Text>
                {item.detail ? (
                  <Text style={styles.detail}>{item.detail}</Text>
                ) : null}
              </View>
              {active ? (
                <Check color={colors.accent} size={18} strokeWidth={2.2} />
              ) : null}
            </PressableScale>
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: 16, marginBottom: 12 },
  options: { flexShrink: 1 },
  list: { gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radii.medium,
  },
  active: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accentBorder,
  },
  copy: { flex: 1, gap: 1 },
  label: { ...typography.label, fontSize: 15, color: colors.text },
  detail: { ...typography.caption, color: colors.dim },
});
