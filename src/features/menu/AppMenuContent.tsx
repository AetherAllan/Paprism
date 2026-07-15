import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Download from "lucide-react-native/icons/download";
import History from "lucide-react-native/icons/history";
import Info from "lucide-react-native/icons/info";
import Languages from "lucide-react-native/icons/languages";
import Search from "lucide-react-native/icons/search";
import Settings2 from "lucide-react-native/icons/settings-2";
import { useTranslation } from "react-i18next";
import { colors, radii } from "@/shared/theme";
import type { AppSection } from "@/types/navigation";

type Item = {
  id: AppSection;
  labelKey: string;
  icon: LucideIcon;
  separated?: boolean;
};

const ITEMS: Item[] = [
  { id: "search", labelKey: "menu.search", icon: Search },
  { id: "saved", labelKey: "library.tabSaved", icon: Bookmark },
  { id: "history", labelKey: "library.tabHistory", icon: History },
  { id: "downloads", labelKey: "library.tabDownloads", icon: Download },
  {
    id: "translation",
    labelKey: "menu.translation",
    icon: Languages,
    separated: true,
  },
  { id: "language", labelKey: "menu.language", icon: Settings2 },
  { id: "about", labelKey: "settings.about", icon: Info },
];

export function AppMenuContent({
  onSelect,
}: {
  onSelect: (section: AppSection) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ARXIVTOK</Text>
        <Text style={styles.title}>{t("menu.title")}</Text>
      </View>
      <View style={styles.items}>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={({ pressed }) => [
                styles.item,
                item.separated && styles.itemSeparated,
                pressed && styles.itemPressed,
              ]}
            >
              <Icon color={colors.muted} size={19} strokeWidth={1.8} />
              <Text style={styles.itemText}>{t(item.labelKey)}</Text>
              <ChevronRight color={colors.dim} size={17} strokeWidth={1.8} />
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  eyebrow: {
    color: colors.dim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  items: { paddingHorizontal: 10 },
  item: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: radii.medium,
  },
  itemSeparated: {
    marginTop: 10,
    paddingTop: 10,
    minHeight: 58,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  itemPressed: { backgroundColor: colors.surfacePressed },
  itemText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
});
