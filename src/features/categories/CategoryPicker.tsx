import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FEED_CATEGORIES,
  normalizeCategories,
  toggleCategorySelection,
  type CategoryOption,
} from "@/lib/categories";
import { colors, spacing, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { IconButton } from "@/shared/ui/IconButton";
import { SearchField } from "@/shared/ui/SearchField";
import { categoryGroupLabel, categoryLabel } from "./categoryLabels";
import { CategoryRow, SelectedCategoryChip } from "./CategoryPickerRows";

type Props = {
  visible: boolean;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
};

type CategorySection = { title: string; data: CategoryOption[] };

export function CategoryPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(() => normalizeCategories(selected));
  const selectedIds = useMemo(() => new Set(draft), [draft]);

  useEffect(() => {
    if (!visible) return;
    setDraft(normalizeCategories(selected));
    setQuery("");
  }, [visible, selected]);

  const searchableCategories = useMemo(() => {
    // categoryLabel reads the shared i18n instance, so language is the
    // explicit invalidation key even though it is not passed as an argument.
    void language;
    return FEED_CATEGORIES.map((category) => ({
      category,
      text: [
        category.id,
        category.label,
        category.group,
        categoryLabel(category.id),
        categoryGroupLabel(category.group),
      ]
        .join("\n")
        .toLocaleLowerCase(),
    }));
  }, [language]);

  const sections = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    const filtered = value
      ? searchableCategories
          .filter((item) => item.text.includes(value))
          .map((item) => item.category)
      : FEED_CATEGORIES;
    return groupBy(filtered);
  }, [query, searchableCategories]);

  const toggle = useCallback((id: string) => {
    setDraft((current) => toggleCategorySelection(current, id));
  }, []);

  const apply = () => {
    onSelect(normalizeCategories(draft));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, 8) + 2,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              {t("categories.title")}
            </Text>
            <Text style={styles.count}>
              {t("categories.selectedCount", { count: draft.length })}
            </Text>
          </View>
          <IconButton
            icon={X}
            iconSize={19}
            color={colors.muted}
            label={t("common.close")}
            onPress={onClose}
          />
        </View>

        <Text style={styles.hint}>{t("categories.hint")}</Text>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t("categories.search")}
          style={styles.searchField}
        />

        <FlatList
          horizontal
          data={draft}
          keyExtractor={(id) => id}
          renderItem={({ item }) => (
            <SelectedCategoryChip
              id={item}
              label={categoryLabel(item)}
              onRemove={toggle}
              removeLabel={t("categories.removeSelection", {
                category: categoryLabel(item),
              })}
            />
          )}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={3}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.selectedList}
          contentContainerStyle={styles.selectedContent}
        />

        <SectionList
          style={styles.categoryList}
          sections={sections}
          extraData={selectedIds}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("categories.noMatches")}</Text>
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.group}>
              {categoryGroupLabel(section.title)}
            </Text>
          )}
          renderItem={({ item }) => {
            return (
              <CategoryRow
                id={item.id}
                label={categoryLabel(item.id)}
                active={selectedIds.has(item.id)}
                onToggle={toggle}
              />
            );
          }}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
        />

        <Button
          variant="primary"
          label={t("common.apply")}
          onPress={apply}
          style={styles.apply}
        />
      </View>
    </Modal>
  );
}

function groupBy(items: CategoryOption[]): CategorySection[] {
  const groups = new Map<string, CategoryOption[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups].map(([title, data]) => ({ title, data }));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: spacing.gutter,
    paddingRight: spacing.gutter - 4,
    marginBottom: 8,
  },
  headerCopy: { flex: 1 },
  title: { ...typography.headline, color: colors.text },
  count: { ...typography.caption, ...typography.numeric, color: colors.dim },
  hint: {
    ...typography.caption,
    color: colors.dim,
    marginHorizontal: spacing.gutter,
    marginBottom: 12,
  },
  searchField: { marginHorizontal: 16 },
  selectedList: {
    flexGrow: 0,
    minHeight: 46,
    marginVertical: 10,
  },
  selectedContent: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingRight: 28,
  },
  categoryList: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 12 },
  group: {
    ...typography.caption,
    color: colors.dim,
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  empty: {
    ...typography.body,
    color: colors.dim,
    textAlign: "center",
    marginTop: 32,
  },
  apply: {
    marginHorizontal: 16,
    marginTop: 10,
  },
});
