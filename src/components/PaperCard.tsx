import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Paper } from "../types/paper";

type Props = {
  paper: Paper;
  height: number;
  saved: boolean;
  downloading: boolean;
  downloaded: boolean;
  onRead: (paper: Paper) => void;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
};

export function PaperCard({
  paper,
  height,
  saved,
  downloading,
  downloaded,
  onRead,
  onToggleSave,
  onDownload,
}: Props) {
  const { t, i18n } = useTranslation();
  const authorLine =
    paper.authors.length <= 3
      ? paper.authors.join(", ")
      : `${paper.authors.slice(0, 3).join(", ")} +${paper.authors.length - 3}`;

  const date = paper.published
    ? new Date(paper.published).toLocaleDateString(
        i18n.language === "zh" ? "zh-CN" : "en",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        },
      )
    : "";

  return (
    <View style={[styles.shell, { height }]}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        bounces
        nestedScrollEnabled
      >
        {date ? <Text style={styles.date}>{date}</Text> : null}

        <Text style={styles.cats} numberOfLines={2}>
          {paper.categories.slice(0, 4).join(" · ")}
        </Text>

        <Text style={styles.title}>{paper.title}</Text>
        <Text style={styles.authors}>{authorLine}</Text>
        <Text style={styles.arxivId}>{paper.arxivId}</Text>

        <Text style={styles.sectionLabel}>{t("common.abstract")}</Text>
        <Text style={styles.abstract}>{paper.abstract}</Text>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.readBtn,
            pressed && styles.pressed,
          ]}
          onPress={() => onRead(paper)}
        >
          <Text style={styles.readBtnText}>{t("common.read")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            saved && styles.secondaryBtnOn,
            pressed && styles.pressed,
          ]}
          onPress={() => onToggleSave(paper)}
        >
          <Text
            style={[styles.secondaryText, saved && styles.secondaryTextOn]}
          >
            {saved ? t("common.saved") : t("common.save")}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.pressed,
          ]}
          disabled={downloading}
          onPress={() => onDownload(paper)}
        >
          <Text style={styles.secondaryText}>
            {downloading
              ? t("common.downloading")
              : downloaded
                ? t("common.downloaded")
                : t("common.download")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#111113",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  date: {
    color: "#71717a",
    fontSize: 12,
    marginBottom: 8,
  },
  cats: {
    color: "#a1a1aa",
    fontSize: 12,
    marginBottom: 12,
  },
  title: {
    color: "#fafafa",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    marginBottom: 10,
  },
  authors: {
    color: "#d4d4d8",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  arxivId: {
    color: "#71717a",
    fontSize: 12,
    marginBottom: 18,
    fontVariant: ["tabular-nums"],
  },
  sectionLabel: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  abstract: {
    color: "#e4e4e7",
    fontSize: 16,
    lineHeight: 25,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  readBtn: {
    flex: 1.2,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  readBtnText: {
    color: "#18181b",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#1c1c1f",
  },
  secondaryBtnOn: {
    backgroundColor: "#27272a",
  },
  secondaryText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryTextOn: {
    color: "#fafafa",
  },
  pressed: {
    opacity: 0.85,
  },
});
