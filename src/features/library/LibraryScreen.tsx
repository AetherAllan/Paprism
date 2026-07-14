import { useRef } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppSection } from "@/types/navigation";
import type { Paper } from "@/types/paper";
import type {
  DownloadSummary,
  HistoryEntry,
  OfflineHtmlEntry,
  PdfDownloadEntry,
  SavedEntry,
} from "./library";

export type LibrarySection = Extract<
  AppSection,
  "saved" | "history" | "downloads"
>;

type Props = {
  visible: boolean;
  section: LibrarySection;
  saved: SavedEntry[];
  history: HistoryEntry[];
  downloads: DownloadSummary[];
  onUnsave: (arxivId: string) => void;
  onClearHistory: () => void;
  onOpenPaper: (paper: Paper) => void;
  onOpenOffline: (entry: OfflineHtmlEntry) => void;
  onOpenPdf: (entry: PdfDownloadEntry) => void;
  onDeleteDownloads: (arxivId: string) => void;
  onBack: () => void;
};

export function LibraryScreen({
  visible,
  section,
  saved,
  history,
  downloads,
  onUnsave,
  onClearHistory,
  onOpenPaper,
  onOpenOffline,
  onOpenPdf,
  onDeleteDownloads,
  onBack,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<LibrarySection, number>>({
    saved: 0,
    history: 0,
    downloads: 0,
  });
  const locale = i18n.language === "zh" ? "zh-CN" : "en";
  const items =
    section === "saved" ? saved : section === "history" ? history : downloads;
  const emptyText =
    section === "saved"
      ? t("library.emptySaved")
      : section === "history"
        ? t("library.emptyHistory")
        : t("library.emptyDownloads");
  const title = t(
    section === "saved"
      ? "library.tabSaved"
      : section === "history"
        ? "library.tabHistory"
        : "library.tabDownloads",
  );

  const confirmClear = () => {
    Alert.alert(t("library.clearHistoryTitle"), t("library.clearHistoryBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("library.clear"),
        style: "destructive",
        onPress: onClearHistory,
      },
    ]);
  };

  const openDownload = (item: DownloadSummary) => {
    if (item.html) onOpenOffline(item.html);
    else if (item.pdf) onOpenPdf(item.pdf);
  };

  const confirmDeleteDownload = (item: DownloadSummary) => {
    Alert.alert(t("library.removeDownloads"), t("library.removeDownloadsBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("library.clear"),
        style: "destructive",
        onPress: () => onDeleteDownloads(item.arxivId),
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onBack}
      onShow={() =>
        scrollRef.current?.scrollTo({
          y: offsets.current[section],
          animated: false,
        })
      }
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>

        {section === "history" ? (
          <Pressable onPress={confirmClear} style={styles.clearRow}>
            <Text style={styles.clearText}>{t("library.clearHistory")}</Text>
          </Pressable>
        ) : null}

        <ScrollView
          key={section}
          ref={scrollRef}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => {
            offsets.current[section] = event.nativeEvent.contentOffset.y;
          }}
        >
          {items.length === 0 ? (
            <Text style={styles.empty}>{emptyText}</Text>
          ) : (
            items.map((item) => (
              <Row
                key={item.arxivId}
                title={item.title}
                subtitle={item.authors.slice(0, 2).join(", ")}
                meta={
                  section === "downloads"
                    ? downloadMeta(item as DownloadSummary, locale)
                    : formatTime(entryTime(item), locale)
                }
                onPress={() =>
                  section === "downloads"
                    ? openDownload(item as DownloadSummary)
                    : onOpenPaper(item)
                }
                actionLabel={
                  section === "saved"
                    ? t("library.unsave")
                    : section === "downloads"
                      ? t("library.manage")
                      : undefined
                }
                onAction={
                  section === "saved"
                    ? () => onUnsave(item.arxivId)
                    : section === "downloads"
                      ? () => confirmDeleteDownload(item as DownloadSummary)
                      : undefined
                }
              />
            ))
          )}
        </ScrollView>

      </View>
    </Modal>
  );
}

function entryTime(item: SavedEntry | HistoryEntry | DownloadSummary): number {
  if ("savedAt" in item) return item.savedAt;
  if ("viewedAt" in item) return item.viewedAt;
  return Math.max(item.html?.downloadedAt ?? 0, item.pdf?.downloadedAt ?? 0);
}

function downloadMeta(item: DownloadSummary, locale: string): string {
  const kinds = [item.html ? "HTML" : null, item.pdf ? "PDF" : null]
    .filter(Boolean)
    .join(" + ");
  return `${kinds} · ${formatTime(entryTime(item), locale)}`;
}

function Row({
  title,
  subtitle,
  meta,
  onPress,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onAction();
          }}
          hitSlop={8}
        >
          <Text style={styles.rowAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111113",
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    color: "#fafafa",
    fontSize: 20,
    fontWeight: "700",
  },
  clearRow: {
    alignSelf: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  clearText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 4,
  },
  empty: {
    color: "#71717a",
    textAlign: "center",
    marginTop: 48,
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowMain: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  rowMeta: {
    color: "#71717a",
    fontSize: 12,
  },
  rowAction: {
    color: "#a1a1aa",
    fontSize: 13,
  },
});
