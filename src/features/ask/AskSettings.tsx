import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ProviderSettings } from "@/features/settings/ProviderSettings";
import { ModelPicker } from "@/features/settings/ModelPicker";
import {
  OPENROUTER_BASE_URL,
  type ModelOption,
} from "@/features/settings/providerCore";
import type { useProviderProfiles } from "@/features/settings/useProviderProfiles";
import { colors, radii } from "@/shared/theme";
import { clearAllAskData } from "./askDatabase";
import { fetchEmbeddingModels } from "./embeddingProviders";
import type { useEmbeddingProfile } from "./useEmbeddingProfile";

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  providerManager: ReturnType<typeof useProviderProfiles>;
  embeddingManager: ReturnType<typeof useEmbeddingProfile>;
};

export function AskSettings({
  enabled,
  onEnabledChange,
  providerManager,
  embeddingManager,
}: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"openrouter" | "openai-compatible">(
    embeddingManager.profile?.kind ?? "openrouter",
  );
  const [baseUrl, setBaseUrl] = useState(
    embeddingManager.profile?.baseUrl ?? OPENROUTER_BASE_URL,
  );
  const [model, setModel] = useState(embeddingManager.profile?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    const profile = embeddingManager.profile;
    if (!profile) return;
    setKind(profile.kind);
    setBaseUrl(profile.baseUrl);
    setModel(profile.model);
  }, [embeddingManager.profile]);

  const saveEmbedding = async () => {
    try {
      await embeddingManager.save(
        {
          id: "ask-embedding",
          name: kind === "openrouter" ? "OpenRouter Embeddings" : "Embeddings",
          kind,
          baseUrl: kind === "openrouter" ? OPENROUTER_BASE_URL : baseUrl,
          model,
        },
        apiKey,
      );
      setApiKey("");
      Alert.alert(t("ask.saved"));
    } catch (error) {
      Alert.alert(
        t("provider.saveFailed"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    }
  };

  const loadModels = async () => {
    try {
      const key = apiKey.trim() || (await embeddingManager.getApiKey());
      if (!key) throw new Error(t("provider.keyRequired"));
      const profile = {
        id: "ask-embedding",
        name: "Embeddings",
        kind,
        baseUrl: kind === "openrouter" ? OPENROUTER_BASE_URL : baseUrl,
        model: model || "pending",
      } as const;
      const loaded = await fetchEmbeddingModels(profile, key);
      setModels(loaded);
      Alert.alert(t("provider.modelsFound", { count: loaded.length }));
    } catch (error) {
      Alert.alert(
        t("provider.connectionFailed"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    }
  };

  return (
    <View>
      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}>
          <Text style={styles.title}>{t("ask.enabled")}</Text>
          <Text style={styles.hint}>{t("ask.enabledHint")}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onEnabledChange}
          thumbColor={enabled ? colors.text : colors.muted}
          trackColor={{
            true: colors.surfacePressed,
            false: colors.surfaceRaised,
          }}
          ios_backgroundColor={colors.surfaceRaised}
        />
      </View>

      <ProviderSettings
        manager={providerManager}
        activeProfileId={providerManager.activeAskProfileId}
        onSelect={providerManager.setActiveAskProfileId}
        includeGoogle={false}
        title={t("ask.chatProvider")}
        hint={t("ask.chatProviderHint")}
      />

      <View style={styles.embedding}>
        <Text style={styles.title}>{t("ask.embeddingProvider")}</Text>
        <Text style={styles.hint}>{t("ask.embeddingHint")}</Text>
        <View style={styles.kindRow}>
          {(["openrouter", "openai-compatible"] as const).map((item) => (
            <Pressable
              key={item}
              style={[styles.kind, kind === item && styles.kindSelected]}
              onPress={() => {
                setKind(item);
                if (item === "openrouter") setBaseUrl(OPENROUTER_BASE_URL);
              }}
            >
              <Text style={styles.kindText}>
                {item === "openrouter"
                  ? "OpenRouter"
                  : t("provider.compatible")}
              </Text>
            </Pressable>
          ))}
        </View>
        {kind === "openai-compatible" ? (
          <TextInput
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://…/v1"
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            style={styles.input}
          />
        ) : null}
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={t("provider.keyPlaceholder")}
          placeholderTextColor={colors.dim}
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder={t("ask.embeddingModel")}
          placeholderTextColor={colors.dim}
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.actionRow}>
          {kind === "openrouter" ? (
            <Pressable
              style={styles.secondary}
              onPress={() => void loadModels()}
            >
              <Text style={styles.secondaryText}>
                {t("provider.testAndLoad")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.primary}
            onPress={() => void saveEmbedding()}
          >
            <Text style={styles.primaryText}>{t("common.save")}</Text>
          </Pressable>
        </View>
        <ModelPicker models={models} selectedId={model} onSelect={setModel} />
        {embeddingManager.profile ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => void embeddingManager.clear()}
          >
            <Text style={styles.clearText}>{t("ask.disableEmbedding")}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.privacy}>{t("ask.privacy")}</Text>
      <Pressable
        style={styles.destructiveButton}
        onPress={() =>
          Alert.alert(t("ask.clearAllTitle"), t("ask.clearAllBody"), [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("library.clear"),
              style: "destructive",
              onPress: () => void clearAllAskData(),
            },
          ])
        }
      >
        <Text style={styles.destructiveText}>{t("ask.clearAll")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  toggleCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.dim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  embedding: { marginTop: 28 },
  kindRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  kind: {
    flex: 1,
    padding: 10,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
  },
  kindSelected: { borderColor: colors.accent, borderWidth: 1 },
  kindText: { color: colors.textSecondary, textAlign: "center", fontSize: 12 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radii.medium,
    padding: 12,
    marginTop: 8,
  },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  secondary: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 12,
  },
  primary: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: radii.medium,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.background,
    textAlign: "center",
    fontWeight: "700",
  },
  privacy: { color: colors.dim, fontSize: 12, lineHeight: 18, marginTop: 24 },
  clearButton: { paddingVertical: 12, marginTop: 8 },
  clearText: { color: colors.danger, textAlign: "center", fontWeight: "600" },
  destructiveButton: {
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    backgroundColor: "rgba(248,113,113,0.12)",
  },
  destructiveText: {
    color: colors.danger,
    textAlign: "center",
    fontWeight: "700",
  },
});
