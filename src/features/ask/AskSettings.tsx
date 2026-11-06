import { StyleSheet, Switch, Text, View } from "react-native";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useTranslation } from "react-i18next";
import { ProviderSettings } from "@/features/settings/ProviderSettings";
import type { useProviderProfiles } from "@/features/settings/useProviderProfiles";
import { colors, surfaces, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { clearAllAskData } from "./askDatabase";
import { fetchEmbeddingModels } from "./embeddingProviders";
import type { useEmbeddingProfile } from "./useEmbeddingProfile";
import { useAppDialog } from "@/shared/AppDialog";

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
  const { showDialog, showError } = useAppDialog();

  return (
    <View>
      <View style={[surfaces.card, styles.toggleRow]}>
        <View style={styles.toggleCopy}>
          <Text style={styles.title}>{t("ask.enabled")}</Text>
          <Text style={styles.hint}>{t("ask.enabledHint")}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onEnabledChange}
          thumbColor={enabled ? colors.accent : colors.muted}
          trackColor={{
            true: colors.accentBorder,
            false: colors.surfacePressed,
          }}
          ios_backgroundColor={colors.surfacePressed}
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

      <ProviderSettings
        manager={embeddingManager}
        includeGoogle={false}
        title={t("ask.embeddingProvider")}
        hint={t("ask.embeddingHint")}
        modelLoader={fetchEmbeddingModels}
      />

      <Text style={styles.privacy}>{t("ask.privacy")}</Text>
      <Button
        variant="danger"
        icon={Trash2}
        label={t("ask.clearAll")}
        style={styles.destructiveButton}
        onPress={() =>
          showDialog({
            kind: "destructive",
            title: t("ask.clearAllTitle"),
            message: t("ask.clearAllBody"),
            actions: [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("library.clear"),
                style: "destructive",
                onPress: async () => {
                  try {
                    await clearAllAskData();
                    showDialog({
                      kind: "success",
                      title: t("ask.clearAllSuccess"),
                    });
                  } catch (error) {
                    showError(t("common.operationFailed"), error);
                  }
                },
              },
            ],
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15,
  },
  toggleCopy: { flex: 1 },
  title: { ...typography.label, color: colors.text },
  hint: { ...typography.caption, color: colors.dim, marginTop: 3 },
  privacy: {
    ...typography.caption,
    color: colors.dim,
    marginTop: 24,
    marginHorizontal: 4,
  },
  destructiveButton: { marginTop: 14 },
});
