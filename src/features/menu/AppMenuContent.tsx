import { memo } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Download from "lucide-react-native/icons/download";
import History from "lucide-react-native/icons/history";
import Info from "lucide-react-native/icons/info";
import Languages from "lucide-react-native/icons/languages";
import MessageCircleQuestion from "lucide-react-native/icons/message-circle-question-mark";
import Search from "lucide-react-native/icons/search";
import Settings2 from "lucide-react-native/icons/settings-2";
import { useTranslation } from "react-i18next";
import { colors, radii, typography } from "@/shared/theme";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { AppSection } from "@/types/navigation";

type Item = {
  id: AppSection;
  labelKey: string;
  icon: LucideIcon;
};

const GROUPS: { titleKey: string; items: Item[] }[] = [
  {
    titleKey: "menu.groupLibrary",
    items: [
      { id: "search", labelKey: "menu.search", icon: Search },
      { id: "saved", labelKey: "library.tabSaved", icon: Bookmark },
      { id: "history", labelKey: "library.tabHistory", icon: History },
      { id: "downloads", labelKey: "library.tabDownloads", icon: Download },
    ],
  },
  {
    titleKey: "menu.groupSettings",
    items: [
      { id: "translation", labelKey: "menu.translation", icon: Languages },
      { id: "ask", labelKey: "menu.ask", icon: MessageCircleQuestion },
      { id: "language", labelKey: "menu.language", icon: Settings2 },
      { id: "about", labelKey: "settings.about", icon: Info },
    ],
  },
];

export const AppMenuContent = memo(function AppMenuContent({
  onSelect,
  updateAvailable,
}: {
  onSelect: (section: AppSection) => void;
  updateAvailable: boolean;
}) {
  const { t } = useTranslation();

  return (
    // Large system font sizes can push the list past a short screen.
    <ScrollView
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brand}>
        <Image
          accessibilityIgnoresInvertColors
          source={require("../../../assets/logo-mark.png")}
          style={styles.logo}
        />
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>Paprism</Text>
          <Text numberOfLines={1} style={styles.brandTagline}>
            {t("menu.tagline")}
          </Text>
        </View>
      </View>
      {GROUPS.map((group) => (
        <View key={group.titleKey} style={styles.group}>
          <Text style={styles.groupTitle}>{t(group.titleKey)}</Text>
          {group.items.map((item) => {
            const Icon = item.icon;
            const showUpdate = item.id === "about" && updateAvailable;
            return (
              <PressableScale
                accessibilityHint={
                  showUpdate ? t("settings.updateAvailable") : undefined
                }
                key={item.id}
                onPress={() => onSelect(item.id)}
                scaleTo={0.98}
                style={styles.item}
              >
                <View style={styles.itemIcon}>
                  <Icon
                    color={colors.textSecondary}
                    size={17}
                    strokeWidth={1.7}
                  />
                </View>
                <Text style={styles.itemText}>{t(item.labelKey)}</Text>
                {showUpdate ? <View style={styles.updateDot} /> : null}
                <ChevronRight color={colors.dim} size={16} strokeWidth={1.7} />
              </PressableScale>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  // The tile in the brand mark is slightly taller than it is wide.
  logo: { width: 44, height: 48, borderRadius: 12 },
  brandCopy: { flex: 1 },
  brandName: { ...typography.headline, color: colors.text },
  brandTagline: { ...typography.caption, color: colors.dim },
  group: { paddingHorizontal: 10, marginBottom: 14 },
  groupTitle: {
    ...typography.caption,
    color: colors.dim,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  item: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    borderRadius: radii.medium,
  },
  itemIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.small,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  itemText: {
    ...typography.label,
    fontSize: 15,
    flex: 1,
    color: colors.textSecondary,
  },
  updateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    boxShadow: `0 0 8px ${colors.accent}`,
  },
});
