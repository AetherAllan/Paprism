import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import X from "lucide-react-native/icons/x";
import { colors, radii, typography } from "@/shared/theme";

const SAVED_KEY_MASK = "••••••••••••";

export function SecretField({
  label,
  value,
  hasSavedKey,
  placeholder,
  clearLabel,
  onChangeText,
}: {
  label?: string;
  value: string;
  hasSavedKey: boolean;
  placeholder: string;
  clearLabel: string;
  onChangeText: (value: string) => void;
}) {
  const [replacingSavedKey, setReplacingSavedKey] = useState(false);
  const showingSavedMask =
    hasSavedKey && !replacingSavedKey && value.length === 0;
  const inputValue = showingSavedMask ? SAVED_KEY_MASK : value;

  useEffect(() => {
    // Saving clears the editable value. Reveal the mask again without ever
    // loading the stored secret into this component.
    if (hasSavedKey && value.length === 0) setReplacingSavedKey(false);
  }, [hasSavedKey, value]);

  const changeValue = (next: string) => {
    if (!showingSavedMask) {
      onChangeText(next);
      return;
    }
    // Bullets are a UI sentinel only. The real secret never leaves SecureStore.
    setReplacingSavedKey(true);
    onChangeText(next.replaceAll("•", ""));
  };

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.shell}>
        <TextInput
          value={inputValue}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          selectionColor={colors.accent}
          secureTextEntry
          selectTextOnFocus={showingSavedMask}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          onChangeText={changeValue}
          style={styles.input}
        />
        {inputValue.length > 0 ? (
          <Pressable
            accessibilityLabel={clearLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setReplacingSavedKey(true);
              onChangeText("");
            }}
            style={({ pressed }) => [
              styles.clear,
              pressed && styles.clearPressed,
            ]}
          >
            <X color={colors.muted} size={16} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { ...typography.caption, color: colors.muted, marginBottom: 7 },
  shell: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clear: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  clearPressed: { opacity: 0.65 },
});
