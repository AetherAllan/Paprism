import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  categoryGroupLabel,
  categoryLabel,
} from "../lib/categoryLabels";
import {
  DEFAULT_CATEGORIES,
  FEED_CATEGORIES,
  normalizeCategories,
  type CategoryOption,
} from "../lib/categories";

type Props = {
  visible: boolean;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
};

export function CategoryPicker({ visible, selected, onSelect, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string[]>(() =>
    normalizeCategories(selected),
  );

  useEffect(() => {
    if (visible) {
      setDraft(normalizeCategories(selected));
      setQuery("");
    }
  }, [visible, selected]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? FEED_CATEGORIES.filter((c) => {
          const label = categoryLabel(c.id).toLowerCase();
          const group = categoryGroupLabel(c.group).toLowerCase();
          return (
            label.includes(q) ||
            c.id.toLowerCase().includes(q) ||
            group.includes(q) ||
            c.label.toLowerCase().includes(q) ||
            c.group.toLowerCase().includes(q)
          );
        })
      : FEED_CATEGORIES;
    return groupBy(filtered);
    // Recompute when language changes so labels refresh
  }, [query, i18n.language]);

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (id === "all") {
        return prev.includes("all") ? [...DEFAULT_CATEGORIES] : ["all"];
      }
      const withoutAll = prev.filter((x) => x !== "all");
      if (withoutAll.includes(id)) {
        const next = withoutAll.filter((x) => x !== id);
        return next.length === 0 ? [...DEFAULT_CATEGORIES] : next;
      }
      return [...withoutAll, id];
    });
  };

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
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("categories.title")}</Text>
          <Pressable onPress={apply} hitSlop={12} style={styles.close}>
            <Text style={styles.closeText}>{t("common.done")}</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>{t("categories.hint")}</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("categories.search")}
          placeholderTextColor="#71717a"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={styles.search}
        />

        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {groups.length === 0 ? (
            <Text style={styles.empty}>{t("categories.noMatches")}</Text>
          ) : (
            groups.map(([group, items]) => (
              <View key={group} style={styles.section}>
                <Text style={styles.group}>{categoryGroupLabel(group)}</Text>
                {items.map((item) => {
                  const active = draft.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggle(item.id)}
                      style={[styles.row, active && styles.rowActive]}
                    >
                      <Text
                        style={[styles.label, active && styles.labelActive]}
                        numberOfLines={2}
                      >
                        {categoryLabel(item.id)}
                      </Text>
                      {active ? <Text style={styles.check}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function groupBy(items: CategoryOption[]): [string, CategoryOption[]][] {
  const map = new Map<string, CategoryOption[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  return [...map.entries()];
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
    paddingBottom: 6,
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
  hint: {
    color: "#71717a",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#1c1c1f",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fafafa",
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  empty: {
    color: "#71717a",
    textAlign: "center",
    marginTop: 32,
  },
  section: {
    gap: 2,
  },
  group: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 10,
  },
  rowActive: {
    backgroundColor: "#1c1c1f",
  },
  label: {
    flex: 1,
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "500",
  },
  labelActive: {
    color: "#fafafa",
  },
  check: {
    color: "#fafafa",
    fontSize: 16,
  },
});
