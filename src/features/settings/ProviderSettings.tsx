import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import { useTranslation } from "react-i18next";
import { colors, radii, surfaces, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { IconButton } from "@/shared/ui/IconButton";
import {
  GOOGLE_PROFILE_ID,
  OPENROUTER_BASE_URL,
  type ProviderProfile,
} from "./providerCore";
import {
  ProviderEditor,
  type EditableProviderManager,
  type ModelLoader,
} from "./ProviderEditor";
import { createProfileId } from "./providers";
import { useAppDialog } from "@/shared/AppDialog";

type Props = {
  manager: EditableProviderManager;
  activeProfileId?: string | null;
  onSelect?: (profileId: string) => Promise<void>;
  includeGoogle?: boolean;
  title?: string;
  hint?: string;
  modelLoader?: ModelLoader;
};

type EditorDraft = {
  profile: ProviderProfile;
  activateAfterSave: boolean;
};

export function ProviderSettings({
  manager,
  activeProfileId = manager.activeProfileId,
  onSelect = manager.setActiveProfileId,
  includeGoogle = true,
  title,
  hint,
  modelLoader,
}: Props) {
  const { t } = useTranslation();
  const { showError } = useAppDialog();
  const [draft, setDraft] = useState<EditorDraft | null>(null);

  const create = (kind: "openrouter" | "openai-compatible") => {
    setDraft({
      profile: {
        id: createProfileId(),
        name: kind === "openrouter" ? "OpenRouter" : t("provider.compatible"),
        kind,
        baseUrl: kind === "openrouter" ? OPENROUTER_BASE_URL : "https://",
        model: "",
      },
      activateAfterSave: true,
    });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title ?? t("provider.title")}</Text>
      <Text style={styles.hint}>{hint ?? t("provider.hint")}</Text>
      {manager.profiles
        .filter((profile) => includeGoogle || profile.id !== GOOGLE_PROFILE_ID)
        .map((profile) => {
          const active = activeProfileId === profile.id;
          return (
            <View
              key={profile.id}
              style={[
                surfaces.card,
                styles.profileRow,
                active && styles.active,
              ]}
            >
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={styles.profileMain}
                onPress={() =>
                  void onSelect(profile.id).catch((error) =>
                    showError(t("common.operationFailed"), error),
                  )
                }
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? (
                    <Check color={colors.inverse} size={12} strokeWidth={3} />
                  ) : null}
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.profileModel} numberOfLines={1}>
                    {profile.model || t("provider.noModel")}
                  </Text>
                </View>
              </Pressable>
              {profile.id !== GOOGLE_PROFILE_ID ? (
                <IconButton
                  icon={Pencil}
                  iconSize={15}
                  color={colors.muted}
                  label={t("provider.edit")}
                  onPress={() =>
                    setDraft({ profile, activateAfterSave: false })
                  }
                  size={40}
                />
              ) : null}
            </View>
          );
        })}
      <View style={styles.addRow}>
        <Button
          size="small"
          icon={Plus}
          label="OpenRouter"
          onPress={() => create("openrouter")}
          style={styles.addButton}
        />
        <Button
          size="small"
          icon={Plus}
          label={t("provider.compatible")}
          onPress={() => create("openai-compatible")}
          style={styles.addButton}
        />
      </View>
      <ProviderEditor
        key={draft?.profile.id ?? "closed"}
        draft={draft?.profile ?? null}
        manager={manager}
        modelLoader={modelLoader}
        onSaved={
          draft?.activateAfterSave
            ? (profile) => onSelect(profile.id)
            : undefined
        }
        onClose={() => setDraft(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  heading: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 4,
    marginHorizontal: 4,
  },
  hint: {
    ...typography.caption,
    color: colors.dim,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  profileRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    marginBottom: 6,
    borderRadius: radii.medium,
  },
  active: { borderColor: colors.accentBorder },
  profileMain: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.surfacePressed,
  },
  radioActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  profileCopy: { flex: 1 },
  profileName: { ...typography.label, color: colors.text },
  profileModel: { ...typography.caption, color: colors.dim, marginTop: 1 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  addButton: { flex: 1 },
});
