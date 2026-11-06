import { memo, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ExternalLink from "lucide-react-native/icons/external-link";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import { useTranslation } from "react-i18next";
import { SectionFrame } from "@/features/menu/SectionFrame";
import { deviceUiLang, type UiLangPref } from "@/i18n";
import { deviceTranslateLang, type TranslateLangPref } from "@/lib/storage";
import { colors, surfaces, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import type { AppSection } from "@/types/navigation";
import { LanguagePickerField } from "./LanguagePickerField";
import { LanguagePickerSheet } from "./LanguagePickerSheet";
import type { LanguageOption } from "./languagePicker";
import { ProviderSettings } from "./ProviderSettings";
import { AskSettings } from "@/features/ask/AskSettings";
import type { useEmbeddingProfile } from "@/features/ask/useEmbeddingProfile";
import type { useProviderProfiles } from "./useProviderProfiles";
import type { useAppUpdate } from "./useAppUpdate";
import { useAppDialog } from "@/shared/AppDialog";

const TRANSLATE_OPTIONS: {
  id: TranslateLangPref;
  labelKey: string;
  keywords?: string[];
}[] = [
  { id: "system", labelKey: "settings.tlSystem" },
  { id: "en", labelKey: "settings.tlEn", keywords: ["English"] },
  {
    id: "zh-CN",
    labelKey: "settings.tlZhCN",
    keywords: ["Chinese Simplified"],
  },
  {
    id: "zh-TW",
    labelKey: "settings.tlZhTW",
    keywords: ["Chinese Traditional"],
  },
  { id: "ja", labelKey: "settings.tlJa", keywords: ["Japanese"] },
  { id: "ko", labelKey: "settings.tlKo", keywords: ["Korean"] },
  { id: "es", labelKey: "settings.tlEs", keywords: ["Spanish"] },
  { id: "fr", labelKey: "settings.tlFr", keywords: ["French"] },
  { id: "de", labelKey: "settings.tlDe", keywords: ["German"] },
  { id: "pt", labelKey: "settings.tlPt", keywords: ["Portuguese"] },
  { id: "ru", labelKey: "settings.tlRu", keywords: ["Russian"] },
  { id: "ar", labelKey: "settings.tlAr", keywords: ["Arabic"] },
  { id: "hi", labelKey: "settings.tlHi", keywords: ["Hindi"] },
];

const UI_LANG_OPTIONS: { id: UiLangPref; labelKey: string }[] = [
  { id: "system", labelKey: "settings.langSystem" },
  { id: "en", labelKey: "settings.langEn" },
  { id: "zh", labelKey: "settings.langZh" },
];

type Props = {
  visible: boolean;
  section: SettingsSection;
  uiLang: UiLangPref;
  translateLang: TranslateLangPref;
  onUiLangChange: (lang: UiLangPref) => void;
  onTranslateLangChange: (lang: TranslateLangPref) => void;
  onReset: () => Promise<void>;
  onBack: () => void;
  providerManager: ReturnType<typeof useProviderProfiles>;
  embeddingManager: ReturnType<typeof useEmbeddingProfile>;
  askEnabled: boolean;
  onAskEnabledChange: (enabled: boolean) => void;
  appUpdate: ReturnType<typeof useAppUpdate>;
};

export type SettingsSection = Extract<
  AppSection,
  "translation" | "ask" | "language" | "about"
>;

// These managers change identity on every parent render. While the screen is
// hidden there is nothing to update, so skip the work until it becomes visible.
export const SettingsScreen = memo(
  function SettingsScreen({
    visible,
    section,
    uiLang,
    translateLang,
    onUiLangChange,
    onTranslateLangChange,
    onReset,
    onBack,
    providerManager,
    embeddingManager,
    askEnabled,
    onAskEnabledChange,
    appUpdate,
  }: Props) {
    const { t } = useTranslation();
    const { showDialog, showError } = useAppDialog();
    const [picker, setPicker] = useState<"ui" | "translation" | null>(null);
    const title = t(
      section === "translation"
        ? "menu.translation"
        : section === "ask"
          ? "menu.ask"
          : section === "language"
            ? "menu.language"
            : "settings.about",
    );
    const uiOptions = useMemo<LanguageOption[]>(() => {
      const resolved = deviceUiLang();
      const resolvedLabel = UI_LANG_OPTIONS.find(
        (option) => option.id === resolved,
      );
      return UI_LANG_OPTIONS.map((option) => ({
        id: option.id,
        label: t(option.labelKey),
        detail:
          option.id === "system" && resolvedLabel
            ? t(resolvedLabel.labelKey)
            : undefined,
      }));
    }, [t]);
    const translateOptions = useMemo<LanguageOption[]>(() => {
      const resolved = deviceTranslateLang();
      const resolvedOption = TRANSLATE_OPTIONS.find(
        (option) => option.id === resolved,
      );
      return TRANSLATE_OPTIONS.map((option) => ({
        id: option.id,
        label: t(option.labelKey),
        detail:
          option.id === "system"
            ? resolvedOption
              ? t(resolvedOption.labelKey)
              : resolved
            : undefined,
        keywords: option.keywords,
      }));
    }, [t]);

    const confirmReset = () => {
      showDialog({
        kind: "destructive",
        title: t("settings.resetTitle"),
        message: t("settings.resetBody"),
        actions: [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("settings.reset"),
            style: "destructive",
            onPress: async () => {
              try {
                await onReset();
                showDialog({
                  kind: "success",
                  title: t("settings.resetSuccess"),
                });
              } catch (error) {
                showError(t("common.operationFailed"), error);
              }
            },
          },
        ],
      });
    };

    const openRelease = async () => {
      if (!appUpdate.release) return;
      try {
        await Linking.openURL(appUpdate.release.url);
      } catch (error) {
        showError(t("common.operationFailed"), error);
      }
    };

    return (
      <SectionFrame visible={visible} title={title} onBackComplete={onBack}>
        <View style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {section === "language" ? (
              <>
                <Text style={styles.section}>{t("settings.appLanguage")}</Text>
                <Text style={styles.hint}>{t("settings.appLanguageHint")}</Text>
                <LanguagePickerField
                  value={uiLang}
                  options={uiOptions}
                  onPress={() => setPicker("ui")}
                />
              </>
            ) : null}

            {section === "translation" ? (
              <>
                <Text style={styles.section}>
                  {t("settings.translationLanguage")}
                </Text>
                <Text style={styles.hint}>{t("settings.translationHint")}</Text>
                <LanguagePickerField
                  value={translateLang}
                  options={translateOptions}
                  onPress={() => setPicker("translation")}
                />
                <ProviderSettings manager={providerManager} />
              </>
            ) : null}

            {section === "ask" ? (
              <AskSettings
                enabled={askEnabled}
                onEnabledChange={onAskEnabledChange}
                providerManager={providerManager}
                embeddingManager={embeddingManager}
              />
            ) : null}

            {section === "about" ? (
              <>
                <View style={styles.brand}>
                  <Image
                    accessibilityIgnoresInvertColors
                    source={require("../../../assets/logo-mark.png")}
                    style={styles.logo}
                  />
                  <Text style={styles.brandName}>Paprism</Text>
                  <Text style={styles.brandTagline}>{t("menu.tagline")}</Text>
                  <Text style={styles.brandVersion}>
                    {t("settings.version", {
                      version: appUpdate.currentVersion,
                    })}
                  </Text>
                </View>

                <View style={[surfaces.card, styles.card]}>
                  <Text style={styles.body}>{t("settings.aboutBody1")}</Text>
                  <Text style={styles.body}>{t("settings.aboutBody2")}</Text>
                </View>

                <View style={[surfaces.card, styles.card]}>
                  <View style={styles.updateCopy}>
                    {appUpdate.status === "checking" ? (
                      <ActivityIndicator color={colors.accent} size="small" />
                    ) : (
                      <View
                        style={[
                          styles.statusDot,
                          appUpdate.status === "available" &&
                            styles.statusDotAvailable,
                          appUpdate.status === "error" && styles.statusDotError,
                        ]}
                      />
                    )}
                    <View style={styles.updateText}>
                      <Text style={styles.updateTitle}>
                        {t(`settings.update.${appUpdate.status}`, {
                          version: appUpdate.release?.version,
                        })}
                      </Text>
                      {appUpdate.status === "available" ? (
                        <Text style={styles.updateHint}>
                          {t("settings.updateAvailableHint")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {appUpdate.status === "available" ? (
                    <Button
                      variant="primary"
                      icon={ExternalLink}
                      label={t("settings.viewUpdate")}
                      onPress={() => void openRelease()}
                    />
                  ) : appUpdate.status === "error" ||
                    appUpdate.status === "current" ? (
                    <Button
                      size="small"
                      icon={RefreshCw}
                      label={t("settings.checkAgain")}
                      onPress={() => void appUpdate.check()}
                    />
                  ) : null}
                </View>

                <Button
                  variant="danger"
                  icon={RotateCcw}
                  label={t("settings.reset")}
                  onPress={confirmReset}
                  style={styles.reset}
                />
              </>
            ) : null}
          </ScrollView>
          <LanguagePickerSheet
            visible={picker === "ui"}
            title={t("settings.appLanguage")}
            value={uiLang}
            options={uiOptions}
            onSelect={(value) => onUiLangChange(value as UiLangPref)}
            onClose={() => setPicker(null)}
          />
          <LanguagePickerSheet
            visible={picker === "translation"}
            title={t("settings.translationLanguage")}
            value={translateLang}
            options={translateOptions}
            searchable
            onSelect={onTranslateLangChange}
            onClose={() => setPicker(null)}
          />
        </View>
      </SectionFrame>
    );
  },
  (previous, next) => !previous.visible && !next.visible,
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  section: {
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
  brand: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },
  logo: { width: 72, height: 78, borderRadius: 19, marginBottom: 14 },
  brandName: { ...typography.display, color: colors.text },
  brandTagline: { ...typography.body, color: colors.muted, marginTop: 2 },
  brandVersion: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.dim,
    marginTop: 8,
  },
  card: {
    padding: 16,
    gap: 12,
    marginBottom: 10,
  },
  body: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  updateCopy: { flexDirection: "row", alignItems: "center", gap: 11 },
  updateText: { flex: 1 },
  updateTitle: { ...typography.label, color: colors.textSecondary },
  updateHint: { ...typography.caption, color: colors.dim, marginTop: 2 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusDotAvailable: {
    backgroundColor: colors.accent,
    boxShadow: `0 0 8px ${colors.accent}`,
  },
  statusDotError: { backgroundColor: colors.dim },
  reset: { marginTop: 14 },
});
