import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UiLangPref } from "@/i18n";
import type { TranslateLangPref } from "@/lib/storage";

const TRANSLATE_OPTIONS: { id: TranslateLangPref; labelKey: string }[] = [
  { id: "system", labelKey: "settings.tlSystem" },
  { id: "en", labelKey: "settings.tlEn" },
  { id: "zh-CN", labelKey: "settings.tlZhCN" },
  { id: "zh-TW", labelKey: "settings.tlZhTW" },
  { id: "ja", labelKey: "settings.tlJa" },
  { id: "ko", labelKey: "settings.tlKo" },
  { id: "es", labelKey: "settings.tlEs" },
  { id: "fr", labelKey: "settings.tlFr" },
  { id: "de", labelKey: "settings.tlDe" },
  { id: "pt", labelKey: "settings.tlPt" },
  { id: "ru", labelKey: "settings.tlRu" },
  { id: "ar", labelKey: "settings.tlAr" },
  { id: "hi", labelKey: "settings.tlHi" },
];

const UI_LANG_OPTIONS: { id: UiLangPref; labelKey: string }[] = [
  { id: "system", labelKey: "settings.langSystem" },
  { id: "en", labelKey: "settings.langEn" },
  { id: "zh", labelKey: "settings.langZh" },
];

type Props = {
  visible: boolean;
  uiLang: UiLangPref;
  translateLang: TranslateLangPref;
  onUiLangChange: (lang: UiLangPref) => void;
  onTranslateLangChange: (lang: TranslateLangPref) => void;
  onReset: () => void;
  onClose: () => void;
};

export function SettingsScreen({
  visible,
  uiLang,
  translateLang,
  onUiLangChange,
  onTranslateLangChange,
  onReset,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("settings.title")}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            <Text style={styles.closeText}>{t("common.done")}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>{t("settings.appLanguage")}</Text>
          <Text style={styles.hint}>{t("settings.appLanguageHint")}</Text>
          {UI_LANG_OPTIONS.map((opt) => {
            const active = opt.id === uiLang;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onUiLangChange(opt.id)}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text style={styles.rowLabel}>{t(opt.labelKey)}</Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}

          <Text style={[styles.section, styles.sectionSpaced]}>
            {t("settings.translationLanguage")}
          </Text>
          <Text style={styles.hint}>{t("settings.translationHint")}</Text>
          {TRANSLATE_OPTIONS.map((option) => {
            const active = option.id === translateLang;
            return (
              <Pressable
                key={option.id}
                onPress={() => onTranslateLangChange(option.id)}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text style={styles.rowLabel}>
                  {t(option.labelKey)}
                </Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}

          <Text style={[styles.section, styles.sectionSpaced]}>
            {t("settings.about")}
          </Text>
          <View style={styles.aboutBox}>
            <Text style={styles.aboutTitle}>ArxivTok</Text>
            <Text style={styles.aboutBody}>
              {t("settings.version", { version: "1.0.0" })}
            </Text>
            <Text style={styles.aboutBody}>{t("settings.aboutBody1")}</Text>
            <Text style={styles.aboutBody}>{t("settings.aboutBody2")}</Text>
          </View>

          <Pressable
            onPress={onReset}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && styles.resetPressed,
            ]}
          >
            <Text style={styles.resetText}>{t("settings.reset")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111113",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    color: "#fafafa",
    fontSize: 20,
    fontWeight: "700",
  },
  close: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  closeText: {
    color: "#a1a1aa",
    fontSize: 16,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  section: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionSpaced: {
    marginTop: 28,
  },
  hint: {
    color: "#71717a",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  rowActive: {
    backgroundColor: "#1c1c1f",
  },
  rowLabel: {
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "500",
  },
  check: {
    color: "#fafafa",
    fontSize: 16,
  },
  aboutBox: {
    backgroundColor: "#1c1c1f",
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  aboutTitle: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "700",
  },
  aboutBody: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 19,
  },
  resetBtn: {
    marginTop: 28,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#1c1c1f",
  },
  resetPressed: {
    opacity: 0.85,
  },
  resetText: {
    color: "#f87171",
    fontSize: 15,
    fontWeight: "600",
  },
});
