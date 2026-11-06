import { memo, useCallback, useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useTranslation } from "react-i18next";
import { colors, typography } from "@/shared/theme";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { PaperBlock } from "./paperDocument";

const INDENT_PER_LEVEL = 14;
const MAX_INDENT_LEVELS = 3;

function headingLevel(block: PaperBlock): number {
  return block.markdown.match(/^#+/)?.[0].length ?? 1;
}

export const ContentsSheet = memo(function ContentsSheet({
  visible,
  headings,
  activeSection,
  onClose,
  onSelect,
}: {
  visible: boolean;
  headings: PaperBlock[];
  /** Heading text of the section currently being read. */
  activeSection: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const baseLevel = useMemo(
    () => (headings.length > 0 ? Math.min(...headings.map(headingLevel)) : 1),
    [headings],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PaperBlock>) => {
      const active = item.plainText === activeSection;
      const depth = Math.min(MAX_INDENT_LEVELS, headingLevel(item) - baseLevel);
      return (
        <PressableScale
          accessibilityState={{ selected: active }}
          onPress={() => onSelect(item.id)}
          scaleTo={0.985}
          style={[styles.row, { paddingLeft: 20 + depth * INDENT_PER_LEVEL }]}
        >
          <View style={[styles.marker, active && styles.markerActive]} />
          <Text
            style={[
              styles.text,
              depth === 0 && styles.textTop,
              active && styles.textActive,
            ]}
          >
            {item.plainText}
          </Text>
        </PressableScale>
      );
    },
    [activeSection, baseLevel, onSelect],
  );

  return (
    <BottomSheet
      visible={visible}
      title={t("reader.contents")}
      onClose={onClose}
      maxHeight="78%"
    >
      <FlatList
        data={headings}
        extraData={activeSection}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={styles.content}
      />
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  list: { flexShrink: 1 },
  content: { paddingBottom: 8 },
  row: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingRight: 20,
    paddingVertical: 10,
  },
  marker: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.surfacePressed,
  },
  markerActive: {
    backgroundColor: colors.accent,
    boxShadow: `0 0 8px ${colors.accent}`,
  },
  text: {
    ...typography.body,
    flexShrink: 1,
    color: colors.muted,
  },
  textTop: { color: colors.textSecondary },
  textActive: { color: colors.text, fontWeight: "500" },
});
