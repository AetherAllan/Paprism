import { useMemo, useState } from "react";
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
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  OPENROUTER_BASE_URL,
  searchModels,
  type ModelOption,
  type ProviderKind,
  type ProviderProfile,
} from "./providerCore";
import { createProfileId, fetchModelCatalog } from "./providers";
import type { useProviderProfiles } from "./useProviderProfiles";

type Manager = ReturnType<typeof useProviderProfiles>;

type Props = { manager: Manager };

export function ProviderSettings({ manager }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProviderProfile | null>(null);

  const create = (kind: ProviderKind) => {
    setDraft({
      id: createProfileId(),
      name: kind === "openrouter" ? "OpenRouter" : t("provider.compatible"),
      kind,
      baseUrl: kind === "openrouter" ? OPENROUTER_BASE_URL : "https://",
      model: "",
    });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("provider.title")}</Text>
      <Text style={styles.hint}>{t("provider.hint")}</Text>
      {manager.profiles.map((profile) => (
        <View key={profile.id} style={styles.profileRow}>
          <Pressable
            style={styles.profileMain}
            onPress={() => void manager.setActiveProfileId(profile.id)}
          >
            <Text style={styles.profileName}>
              {manager.activeProfileId === profile.id ? "✓ " : ""}
              {profile.name}
            </Text>
            <Text style={styles.profileModel} numberOfLines={1}>
              {profile.model || t("provider.noModel")}
            </Text>
          </Pressable>
          <Pressable onPress={() => setDraft(profile)} hitSlop={8}>
            <Text style={styles.edit}>{t("provider.edit")}</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <Pressable style={styles.addButton} onPress={() => create("openrouter")}>
          <Text style={styles.addText}>+ OpenRouter</Text>
        </Pressable>
        <Pressable
          style={styles.addButton}
          onPress={() => create("openai-compatible")}
        >
          <Text style={styles.addText}>+ {t("provider.compatible")}</Text>
        </Pressable>
      </View>
      <ProviderEditor
        key={draft?.id ?? "closed"}
        draft={draft}
        manager={manager}
        onClose={() => setDraft(null)}
      />
    </View>
  );
}

function ProviderEditor({
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
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);

  if (!draft || !form) return null;

  const visibleModels = useMemo(
    () => searchModels(models, query).slice(0, 50),
    [models, query],
  );

  const loadModels = async () => {
    setLoading(true);
    try {
      const key = apiKey.trim() || (await manager.getApiKey(form.id));
      const next = await fetchModelCatalog(form, key, true);
      setModels(next);
      Alert.alert(t("provider.connectionOk"), t("provider.modelsFound", { count: next.length }));
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
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.editor, { paddingTop: insets.top + 8 }]}>
        <View style={styles.editorHeader}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.edit}>{t("common.cancel")}</Text>
          </Pressable>
          <Text style={styles.editorTitle}>{t("provider.editTitle")}</Text>
          <Pressable onPress={() => void save()} hitSlop={10}>
            <Text style={styles.save}>{t("common.done")}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.editorBody} keyboardShouldPersistTaps="handled">
          <Field
            label={t("provider.name")}
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
          />
          <Field label={t("provider.kind")} value={form.kind} editable={false} />
          <Field
            label={t("provider.endpoint")}
            value={form.baseUrl}
            editable={form.kind === "openai-compatible"}
            autoCapitalize="none"
            onChangeText={(baseUrl) => setForm({ ...form, baseUrl })}
          />
          <Field
            label={t("provider.apiKey")}
            value={apiKey}
            placeholder={t("provider.keyPlaceholder")}
            secureTextEntry
            autoCapitalize="none"
            onChangeText={setApiKey}
          />
          <Field
            label={t("provider.model")}
            value={form.model}
            autoCapitalize="none"
            onChangeText={(model) => setForm({ ...form, model })}
          />
          <Pressable style={styles.testButton} onPress={() => void loadModels()} disabled={loading}>
            <Text style={styles.testText}>
              {loading ? t("provider.loadingModels") : t("provider.testAndLoad")}
            </Text>
          </Pressable>
          {models.length > 0 ? (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("provider.searchModels")}
                placeholderTextColor="#71717a"
                style={styles.input}
              />
              {visibleModels.map((model, index) => (
                <Pressable
                  key={model.id}
                  style={styles.modelRow}
                  onPress={() => setForm({ ...form, model: model.id })}
                >
                  <View style={styles.profileMain}>
                    <Text style={styles.profileName} numberOfLines={1}>{model.name}</Text>
                    <Text style={styles.profileModel} numberOfLines={1}>{model.id}</Text>
                  </View>
                  {model.free && index < 5 ? <Text style={styles.free}>FREE</Text> : null}
                </Pressable>
              ))}
            </>
          ) : null}
          {manager.profiles.some((profile) => profile.id === form.id) ? (
            <Pressable style={styles.deleteButton} onPress={remove}>
              <Text style={styles.deleteText}>{t("provider.delete")}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#71717a"
        style={[styles.input, inputProps.editable === false && styles.disabled]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  heading: { color: "#71717a", fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 4 },
  hint: { color: "#71717a", fontSize: 13, lineHeight: 18, marginBottom: 10, marginHorizontal: 4 },
  profileRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1c1c1f", borderRadius: 8, padding: 12, marginBottom: 6 },
  profileMain: { flex: 1 },
  profileName: { color: "#f4f4f5", fontSize: 14, fontWeight: "600" },
  profileModel: { color: "#71717a", fontSize: 12, marginTop: 3 },
  edit: { color: "#a1a1aa", fontSize: 14, fontWeight: "600" },
  addRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  addButton: { flex: 1, backgroundColor: "#27272a", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  addText: { color: "#f4f4f5", fontSize: 13, fontWeight: "600" },
  editor: { flex: 1, backgroundColor: "#111113" },
  editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 },
  editorTitle: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  save: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  editorBody: { padding: 16, paddingBottom: 48 },
  field: { marginBottom: 14 },
  label: { color: "#a1a1aa", fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: "#1c1c1f", borderRadius: 8, color: "#fafafa", paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  disabled: { color: "#71717a" },
  testButton: { backgroundColor: "#f4f4f5", borderRadius: 8, paddingVertical: 13, alignItems: "center", marginBottom: 14 },
  testText: { color: "#18181b", fontWeight: "700" },
  modelRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
  free: { color: "#4ade80", fontSize: 11, fontWeight: "700", marginLeft: 8 },
  deleteButton: { marginTop: 28, alignItems: "center", paddingVertical: 13 },
  deleteText: { color: "#f87171", fontWeight: "600" },
});
