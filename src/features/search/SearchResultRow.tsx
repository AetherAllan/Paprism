import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import BookmarkCheck from "lucide-react-native/icons/bookmark-check";
import Download from "lucide-react-native/icons/download";
import FileCheck from "lucide-react-native/icons/file-check";
import { useTranslation } from "react-i18next";
import { formatAuthors, formatPaperDate } from "@/shared/format";
import { colors, surfaces, typography } from "@/shared/theme";
import { IconButton } from "@/shared/ui/IconButton";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { Paper } from "@/types/paper";

type Props = {
  paper: Paper;
  saved: boolean;
  downloaded: boolean;
  onRead: (paper: Paper) => void;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
};

export const SearchResultRow = memo(function SearchResultRow({
  paper,
  saved,
  downloaded,
  onRead,
  onToggleSave,
  onDownload,
}: Props) {
  const { t, i18n } = useTranslation();
  const meta = useMemo(
    () =>
      [
        formatPaperDate(paper.published, i18n.language),
        paper.categories.slice(0, 3).join(" · "),
      ]
        .filter(Boolean)
        .join("  ·  "),
    [i18n.language, paper.categories, paper.published],
  );

  return (
    <PressableScale
      accessibilityLabel={paper.title}
      accessibilityHint={t("common.read")}
      onPress={() => onRead(paper)}
      scaleTo={0.985}
      style={[surfaces.card, styles.result]}
    >
      {meta ? (
        <Text numberOfLines={1} style={styles.meta}>
          {meta}
        </Text>
      ) : null}
      <Text style={styles.title}>{paper.title}</Text>
      <Text style={styles.authors} numberOfLines={1}>
        {formatAuthors(paper.authors)}
      </Text>
      <Text style={styles.abstract} numberOfLines={3}>
        {paper.abstract}
      </Text>
      <View style={styles.actions}>
        <IconButton
          icon={saved ? BookmarkCheck : Bookmark}
          iconSize={17}
          color={saved ? colors.accent : colors.muted}
          label={t(saved ? "common.saved" : "common.save")}
          size={40}
          onPress={() => onToggleSave(paper)}
        />
        <IconButton
          icon={downloaded ? FileCheck : Download}
          iconSize={17}
          color={downloaded ? colors.text : colors.muted}
          label={t(downloaded ? "common.downloaded" : "common.download")}
          size={40}
          onPress={() => onDownload(paper)}
        />
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  result: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    gap: 5,
  },
  meta: { ...typography.caption, ...typography.numeric, color: colors.dim },
  title: { ...typography.title, color: colors.text },
  authors: { ...typography.caption, fontSize: 13, color: colors.textSecondary },
  abstract: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
});
