import { useEffect, useRef } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import Clock3 from "lucide-react-native/icons/clock-3";
import Download from "lucide-react-native/icons/download";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useTranslation } from "react-i18next";
import { SectionFrame } from "@/features/menu/SectionFrame";
import { colors } from "@/shared/theme";
import type { AppSection } from "@/types/navigation";
import type { Paper } from "@/types/paper";
import type {
  DownloadSummary,
  HistoryEntry,
  OfflinePaperEntry,
  PdfDownloadEntry,
  SavedEntry,
} from "./library";
import { LibraryRow } from "./LibraryRow";

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
  onOpenOffline: (entry: OfflinePaperEntry) => void;
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

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: offsets.current[section],
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [section, visible]);

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
    if (item.offline) onOpenOffline(item.offline);
    else if (item.pdf) onOpenPdf(item.pdf);
  };

  const confirmDeleteDownload = (item: DownloadSummary) => {
    Alert.alert(
      t("library.removeDownloads"),
      t("library.removeDownloadsBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("library.clear"),
          style: "destructive",
          onPress: () => onDeleteDownloads(item.arxivId),
        },
      ],
    );
  };

  return (
    <SectionFrame visible={visible} title={title} onBackComplete={onBack}>
      <View style={styles.root}>
        {section === "history" ? (
          <Pressable onPress={confirmClear} style={styles.clearRow}>
            <Trash2 color={colors.danger} size={15} strokeWidth={1.8} />
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
            <View style={styles.emptyState}>
              {section === "saved" ? (
                <Bookmark color={colors.dim} size={28} strokeWidth={1.4} />
              ) : section === "history" ? (
                <Clock3 color={colors.dim} size={28} strokeWidth={1.4} />
              ) : (
                <Download color={colors.dim} size={28} strokeWidth={1.4} />
              )}
              <Text style={styles.empty}>{emptyText}</Text>
            </View>
          ) : (
            items.map((item) => (
              <LibraryRow
                key={item.arxivId}
                title={item.title}
                subtitle={item.authors.slice(0, 2).join(", ")}
                meta={
                  section === "downloads"
                    ? downloadMeta(
                        item as DownloadSummary,
                        locale,
                        t("library.readerPackage"),
                      )
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
    </SectionFrame>
  );
}

function entryTime(item: SavedEntry | HistoryEntry | DownloadSummary): number {
  if ("savedAt" in item) return item.savedAt;
  if ("viewedAt" in item) return item.viewedAt;
  return Math.max(item.offline?.downloadedAt ?? 0, item.pdf?.downloadedAt ?? 0);
}

function downloadMeta(
  item: DownloadSummary,
  locale: string,
  readerLabel: string,
): string {
  const kinds = [item.offline ? readerLabel : null, item.pdf ? "PDF" : null]
    .filter(Boolean)
    .join(" + ");
  return `${kinds} · ${formatTime(entryTime(item), locale)}`;
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
  root: { flex: 1 },
  clearRow: {
    alignSelf: "flex-end",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  clearText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 9,
  },
  emptyState: { alignItems: "center", gap: 12, marginTop: 48 },
  empty: {
    color: colors.dim,
    textAlign: "center",
    fontSize: 14,
  },
});
