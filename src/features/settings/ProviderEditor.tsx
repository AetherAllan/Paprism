import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Plug from "lucide-react-native/icons/plug";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/TextField";
import { type ModelOption, type ProviderProfile } from "./providerCore";
import { fetchModelCatalog } from "./providers";
import { ModelPicker } from "./ModelPicker";
import { SecretField } from "./SecretField";
import { useAppDialog } from "@/shared/AppDialog";

export type EditableProviderManager = {
  profiles: ProviderProfile[];
  activeProfileId: string | null;
  saveProfile: (profile: ProviderProfile, apiKey?: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  setActiveProfileId: (profileId: string) => Promise<void>;
  getApiKey: (profileId: string) => Promise<string | null>;
};

export type ModelLoader = (
  profile: ProviderProfile,
  apiKey: string,
) => Promise<ModelOption[]>;

const loadProviderModels: ModelLoader = (profile, apiKey) =>
  fetchModelCatalog(profile, apiKey, true);

export function ProviderEditor({
  draft,
  manager,
  modelLoader = loadProviderModels,
  onSaved,
  onClose,
}: {
  draft: ProviderProfile | null;
  manager: EditableProviderManager;
  modelLoader?: ModelLoader;
  onSaved?: (profile: ProviderProfile) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { showDialog, showError } = useAppDialog();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ProviderProfile | null>(draft);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
      if (!key) throw new Error(t("provider.keyRequired"));
      const next = await modelLoader(form, key);
      setModels(next);
      showDialog({
        kind: "success",
        title: t("provider.connectionOk"),
        message: t("provider.modelsFound", { count: next.length }),
      });
    } catch (error) {
      showError(t("provider.connectionFailed"), error);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const existingKey = apiKey.trim() || (await manager.getApiKey(form.id));
      if (!existingKey) throw new Error(t("provider.keyRequired"));
      await manager.saveProfile(form, apiKey);
      await onSaved?.(form);
      onClose();
      showDialog({ kind: "success", title: t("provider.saved") });
    } catch (error) {
      showError(t("provider.saveFailed"), error);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    showDialog({
      kind: "destructive",
      title: t("provider.deleteTitle"),
      message: form.name,
      actions: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await manager.deleteProfile(form.id);
              onClose();
              showDialog({
                kind: "success",
                title: t("provider.deleted"),
              });
            } catch (error) {
              showError(t("common.operationFailed"), error);
            }
          },
        },
      ],
    });
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.editor, { paddingTop: Math.max(insets.top, 8) + 2 }]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={12}
            style={styles.headerAction}
          >
            <Text style={styles.secondaryAction}>{t("common.cancel")}</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={styles.title}
          >
            {t("provider.editTitle")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: saving }}
            disabled={saving}
            onPress={() => void save()}
            hitSlop={12}
            style={[styles.headerAction, styles.headerActionEnd]}
          >
            <Text style={styles.save}>{t("common.done")}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextField
            label={t("provider.name")}
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
          />
          <TextField
            label={t("provider.kind")}
            value={
              form.kind === "openrouter"
                ? "OpenRouter"
                : t("provider.compatible")
            }
            editable={false}
          />
          <TextField
            label={t("provider.endpoint")}
            value={form.baseUrl}
            editable={form.kind === "openai-compatible"}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
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
          <TextField
            label={t("provider.model")}
            value={form.model}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(model) => setForm({ ...form, model })}
          />
          <Button
            icon={Plug}
            label={
              loading ? t("provider.loadingModels") : t("provider.testAndLoad")
            }
            loading={loading}
            onPress={() => void loadModels()}
            style={styles.testButton}
          />
          <ModelPicker
            models={models}
            selectedId={form.model}
            onSelect={(model) => setForm({ ...form, model })}
          />
          {isExisting ? (
            <Button
              variant="danger"
              icon={Trash2}
              label={t("provider.delete")}
              onPress={remove}
              style={styles.deleteButton}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  editor: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: spacing.gutter,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerAction: { minWidth: 64, minHeight: 40, justifyContent: "center" },
  headerActionEnd: { alignItems: "flex-end" },
  title: { ...typography.title, flexShrink: 1, color: colors.text },
  secondaryAction: { ...typography.label, color: colors.muted },
  save: { ...typography.label, fontWeight: "600", color: colors.accent },
  body: { padding: 16 },
  testButton: { marginTop: 2, marginBottom: 14 },
  deleteButton: { marginTop: 24 },
});
