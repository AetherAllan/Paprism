import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Check from "lucide-react-native/icons/check";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "@/shared/theme";
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
  const insets = useSafeAreaInsets();
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

    // Android otherwise runs the IME and Modal slide animations together,
    // which can leave a half-dismissed sheet visible for one frame sequence.
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel={t("common.close")}
          style={styles.backdrop}
          onPress={requestClose}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityLabel={t("common.close")}
              hitSlop={10}
              onPress={requestClose}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <X color={colors.muted} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>

          {searchable ? (
            <View style={styles.searchShell}>
              <Search color={colors.dim} size={18} strokeWidth={1.8} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("settings.searchLanguage")}
                placeholderTextColor={colors.dim}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                style={styles.search}
              />
            </View>
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
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    onSelect(item.id);
                    requestClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.active,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.copy}>
                    <Text style={styles.label}>{item.label}</Text>
                    {item.detail ? (
                      <Text style={styles.detail}>{item.detail}</Text>
                    ) : null}
                  </View>
                  {active ? (
                    <Check color={colors.text} size={19} strokeWidth={2.2} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    maxHeight: "82%",
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginBottom: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfacePressed,
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
  },
  searchShell: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  options: { flexShrink: 1 },
  list: { gap: 6, paddingBottom: 8 },
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  active: {
    backgroundColor: colors.surfacePressed,
    borderColor: colors.borderStrong,
  },
  pressed: { opacity: 0.82 },
  copy: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  detail: { color: colors.dim, fontSize: 12 },
});
