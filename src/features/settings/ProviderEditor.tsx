import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "@/shared/theme";
import { type ModelOption, type ProviderProfile } from "./providerCore";
import { fetchModelCatalog } from "./providers";
import type { useProviderProfiles } from "./useProviderProfiles";
import { ModelPicker } from "./ModelPicker";

type Manager = ReturnType<typeof useProviderProfiles>;
const SAVED_KEY_MASK = "••••••••••••";

export function ProviderEditor({
  draft,
  manager,
  onClose,
}: {
  draft: ProviderProfile | null;
  manager: Manager;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ProviderProfile | null>(draft);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const isExisting = draft
    ? manager.profiles.some((profile) => profile.id === draft.id)
    : false;
  const getApiKey = manager.getApiKey;

  useEffect(() => {
    if (!draft || !isExisting) {
      setHasSavedKey(false);
      return;
    }

    let cancelled = false;
    void getApiKey(draft.id).then(
      (key) => {
        // Only the existence bit enters React state. The secret itself remains
        // owned by SecureStore and is never copied into the editable field.
        if (!cancelled) setHasSavedKey(Boolean(key));
      },
      () => {
        if (!cancelled) setHasSavedKey(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft, getApiKey, isExisting]);

  if (!draft || !form) return null;

  const loadModels = async () => {
    setLoading(true);
    try {
      const key = apiKey.trim() || (await manager.getApiKey(form.id));
      const next = await fetchModelCatalog(form, key, true);
      setModels(next);
      Alert.alert(
        t("provider.connectionOk"),
        t("provider.modelsFound", { count: next.length }),
      );
    } catch (error) {
      Alert.alert(
        t("provider.connectionFailed"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      const existingKey = apiKey.trim() || (await manager.getApiKey(form.id));
      if (!existingKey) throw new Error(t("provider.keyRequired"));
      await manager.saveProfile(form, apiKey);
      onClose();
    } catch (error) {
      Alert.alert(
        t("provider.saveFailed"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    }
  };

  const remove = () => {
    Alert.alert(t("provider.deleteTitle"), form.name, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("library.clear"),
        style: "destructive",
        onPress: () => void manager.deleteProfile(form.id).then(onClose),
      },
    ]);
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.editor, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.secondaryAction}>{t("common.cancel")}</Text>
          </Pressable>
          <Text style={styles.title}>{t("provider.editTitle")}</Text>
          <Pressable onPress={() => void save()} hitSlop={10}>
            <Text style={styles.save}>{t("common.done")}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Field
            label={t("provider.name")}
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
          />
          <Field
            label={t("provider.kind")}
            value={form.kind}
            editable={false}
          />
          <Field
            label={t("provider.endpoint")}
            value={form.baseUrl}
            editable={form.kind === "openai-compatible"}
            autoCapitalize="none"
            onChangeText={(baseUrl) => setForm({ ...form, baseUrl })}
          />
          <SecretField
            label={t("provider.apiKey")}
            value={apiKey}
            hasSavedKey={hasSavedKey}
            placeholder={t("provider.keyPlaceholder")}
            clearLabel={t("provider.clearKey")}
            onChangeText={setApiKey}
          />
          <Field
            label={t("provider.model")}
            value={form.model}
            autoCapitalize="none"
            onChangeText={(model) => setForm({ ...form, model })}
          />
          <Pressable
            style={styles.testButton}
            onPress={() => void loadModels()}
            disabled={loading}
          >
            <Text style={styles.testText}>
              {loading
                ? t("provider.loadingModels")
                : t("provider.testAndLoad")}
            </Text>
          </Pressable>
          <ModelPicker
            models={models}
            selectedId={form.model}
            onSelect={(model) => setForm({ ...form, model })}
          />
          {manager.profiles.some((profile) => profile.id === form.id) ? (
            <Pressable style={styles.deleteButton} onPress={remove}>
              <Trash2 color={colors.danger} size={17} strokeWidth={1.8} />
              <Text style={styles.deleteText}>{t("provider.delete")}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field(
  props: React.ComponentProps<typeof TextInput> & { label: string },
) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.dim}
        style={[styles.input, inputProps.editable === false && styles.disabled]}
        {...inputProps}
      />
    </View>
  );
}

function SecretField({
  label,
  value,
  hasSavedKey,
  placeholder,
  clearLabel,
  onChangeText,
}: {
  label: string;
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

  const changeValue = (next: string) => {
    if (!showingSavedMask) {
      onChangeText(next);
      return;
    }

    // The editable bullets are only a local sentinel. The first keyboard edit
    // replaces them, and they must never be mistaken for a new API key.
    setReplacingSavedKey(true);
    onChangeText(next.replaceAll("•", ""));
  };

  const clearValue = () => {
    setReplacingSavedKey(true);
    onChangeText("");
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.secretInputShell}>
        <TextInput
          value={inputValue}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          secureTextEntry
          selectTextOnFocus={showingSavedMask}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          onChangeText={changeValue}
          style={styles.secretInput}
        />
        {inputValue.length > 0 ? (
          <Pressable
            accessibilityLabel={clearLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={clearValue}
            style={({ pressed }) => [
              styles.clearKey,
              pressed && styles.clearKeyPressed,
            ]}
          >
            <X color={colors.muted} size={17} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  secondaryAction: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  save: { color: colors.text, fontSize: 15, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 48 },
  field: { marginBottom: 14 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  secretInputShell: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  secretInput: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  clearKey: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  clearKeyPressed: { opacity: 0.65 },
  disabled: { color: colors.dim },
  testButton: {
    backgroundColor: colors.text,
    borderRadius: radii.medium,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  testText: { color: colors.inverse, fontWeight: "700" },
  deleteButton: {
    marginTop: 28,
    minHeight: 44,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  deleteText: { color: colors.danger, fontWeight: "600" },
});
