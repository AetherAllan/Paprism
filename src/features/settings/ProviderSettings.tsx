import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Check from "lucide-react-native/icons/check";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/shared/theme";
import {
  GOOGLE_PROFILE_ID,
  OPENROUTER_BASE_URL,
  type ProviderProfile,
} from "./providerCore";
import { ProviderEditor } from "./ProviderEditor";
import { createProfileId } from "./providers";
import type { useProviderProfiles } from "./useProviderProfiles";

type Manager = ReturnType<typeof useProviderProfiles>;

type Props = { manager: Manager };

export function ProviderSettings({ manager }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProviderProfile | null>(null);

  const create = (kind: "openrouter" | "openai-compatible") => {
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
            <View style={styles.profileTitle}>
              {manager.activeProfileId === profile.id ? (
                <Check color={colors.text} size={15} strokeWidth={2} />
              ) : null}
              <Text style={styles.profileName}>{profile.name}</Text>
            </View>
            <Text style={styles.profileModel} numberOfLines={1}>
              {profile.model || t("provider.noModel")}
            </Text>
          </Pressable>
          {profile.id !== GOOGLE_PROFILE_ID ? (
            <Pressable
              accessibilityLabel={t("provider.edit")}
              onPress={() => setDraft(profile)}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Pencil color={colors.muted} size={16} strokeWidth={1.8} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <View style={styles.addRow}>
        <Pressable
          style={styles.addButton}
          onPress={() => create("openrouter")}
        >
          <Plus color={colors.textSecondary} size={16} strokeWidth={1.8} />
          <Text style={styles.addText}>OpenRouter</Text>
        </Pressable>
        <Pressable
          style={styles.addButton}
          onPress={() => create("openai-compatible")}
        >
          <Plus color={colors.textSecondary} size={16} strokeWidth={1.8} />
          <Text style={styles.addText}>{t("provider.compatible")}</Text>
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

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  heading: {
    color: colors.dim,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 4,
  },
  hint: {
    color: colors.dim,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 7,
  },
  profileMain: { flex: 1 },
  profileTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  profileModel: { color: colors.dim, fontSize: 12, marginTop: 3 },
  edit: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.small,
    backgroundColor: colors.surfaceRaised,
  },
  addRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  addButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
});
