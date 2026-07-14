import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FEED_CATEGORIES,
  normalizeCategories,
  toggleCategorySelection,
  type CategoryOption,
} from "@/lib/categories";
import { colors, radii } from "@/shared/theme";
import {
  categoryGroupLabel,
  categoryLabel,
} from "./categoryLabels";
import { CategoryRow, SelectedCategoryChip } from "./CategoryPickerRows";

type Props = {
  visible: boolean;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
};

type CategorySection = { title: string; data: CategoryOption[] };

export function CategoryPicker({ visible, selected, onSelect, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(() => normalizeCategories(selected));
  const selectedIds = useMemo(() => new Set(draft), [draft]);

  useEffect(() => {
    if (!visible) return;
    setDraft(normalizeCategories(selected));
    setQuery("");
  }, [visible, selected]);

  const searchableCategories = useMemo(
    () =>
      FEED_CATEGORIES.map((category) => ({
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
      })),
    [i18n.language],
  );

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
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("categories.title")}</Text>
            <Text style={styles.count}>
              {t("categories.selectedCount", { count: draft.length })}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={t("common.close")}
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <X color={colors.muted} size={20} strokeWidth={1.8} />
          </Pressable>
        </View>

        <Text style={styles.hint}>{t("categories.hint")}</Text>

        <View style={styles.searchShell}>
          <Search color={colors.dim} size={18} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("categories.search")}
            placeholderTextColor={colors.dim}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={styles.search}
          />
        </View>

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
            <Text style={styles.group}>{categoryGroupLabel(section.title)}</Text>
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

        <Pressable
          onPress={apply}
          style={({ pressed }) => [styles.apply, pressed && styles.applyPressed]}
        >
          <Text style={styles.applyText}>{t("common.apply")}</Text>
        </Pressable>
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
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  count: { color: colors.dim, fontSize: 12, marginTop: 2 },
  hint: {
    color: colors.dim,
    fontSize: 12,
    lineHeight: 17,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
  },
  searchShell: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 16,
    paddingHorizontal: 13,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  selectedList: {
    flexGrow: 0,
    minHeight: 54,
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
    color: colors.dim,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 4,
    paddingTop: 13,
    paddingBottom: 7,
    backgroundColor: colors.background,
  },
  empty: { color: colors.dim, textAlign: "center", marginTop: 32 },
  apply: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: radii.medium,
    backgroundColor: colors.text,
  },
  applyPressed: { opacity: 0.82 },
  applyText: { color: colors.inverse, fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});
