import { memo, useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from "react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import BookmarkX from "lucide-react-native/icons/bookmark-x";
import Clock3 from "lucide-react-native/icons/clock-3";
import Download from "lucide-react-native/icons/download";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useTranslation } from "react-i18next";
import { SectionFrame } from "@/features/menu/SectionFrame";
import { formatAuthors, formatEntryTime } from "@/shared/format";
import { colors } from "@/shared/theme";
import { useAppDialog } from "@/shared/AppDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
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

type LibraryItem = SavedEntry | HistoryEntry | DownloadSummary;

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

const EMPTY_ICON = {
  saved: Bookmark,
  history: Clock3,
  downloads: Download,
} as const;

const keyExtractor = (item: LibraryItem) => item.arxivId;

// History changes on every feed page. While this screen is hidden, nothing it
// renders is on screen, so those updates can wait until it becomes visible.
export const LibraryScreen = memo(
  function LibraryScreen({
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
    const { showDialog } = useAppDialog();
    const listRef = useRef<FlatList<LibraryItem>>(null);
    const offsets = useRef<Record<LibrarySection, number>>({
      saved: 0,
      history: 0,
      downloads: 0,
    });
    const language = i18n.language;
    const items: LibraryItem[] =
      section === "saved" ? saved : section === "history" ? history : downloads;
    const title = t(
      section === "saved"
        ? "library.tabSaved"
        : section === "history"
          ? "library.tabHistory"
          : "library.tabDownloads",
    );
    const emptyText = t(
      section === "saved"
        ? "library.emptySaved"
        : section === "history"
          ? "library.emptyHistory"
          : "library.emptyDownloads",
    );

    useEffect(() => {
      if (!visible) return;
      const frame = requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: offsets.current[section],
          animated: false,
        });
      });
      return () => cancelAnimationFrame(frame);
    }, [section, visible]);

    const confirmClear = () => {
      showDialog({
        kind: "destructive",
        title: t("library.clearHistoryTitle"),
        message: t("library.clearHistoryBody"),
        actions: [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("library.clear"),
            style: "destructive",
            onPress: onClearHistory,
          },
        ],
      });
    };

    const openItem = useCallback(
      (item: LibraryItem) => {
        if (section !== "downloads") {
          onOpenPaper(item);
          return;
        }
        const download = item as DownloadSummary;
        if (download.offline) onOpenOffline(download.offline);
        else if (download.pdf) onOpenPdf(download.pdf);
      },
      [onOpenOffline, onOpenPaper, onOpenPdf, section],
    );

    const runItemAction = useCallback(
      (item: LibraryItem) => {
        if (section === "saved") {
          onUnsave(item.arxivId);
          return;
        }
        showDialog({
          kind: "destructive",
          title: t("library.removeDownloads"),
          message: t("library.removeDownloadsBody"),
          actions: [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("common.delete"),
              style: "destructive",
              onPress: () => onDeleteDownloads(item.arxivId),
            },
          ],
        });
      },
      [onDeleteDownloads, onUnsave, section, showDialog, t],
    );

    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<LibraryItem>) => (
        <LibraryRow
          item={item}
          title={item.title}
          subtitle={formatAuthors(item.authors, 2)}
          meta={
            section === "downloads"
              ? downloadMeta(
                  item as DownloadSummary,
                  language,
                  t("library.readerPackage"),
                )
              : formatEntryTime(entryTime(item), language)
          }
          onPress={openItem}
          actionLabel={
            section === "saved"
              ? t("library.unsave")
              : section === "downloads"
                ? t("library.removeDownloads")
                : undefined
          }
          actionIcon={
            section === "saved"
              ? BookmarkX
              : section === "downloads"
                ? Trash2
                : undefined
          }
          onAction={section === "history" ? undefined : runItemAction}
        />
      ),
      [language, openItem, runItemAction, section, t],
    );

    return (
      <SectionFrame
        visible={visible}
        title={title}
        subtitle={
          items.length > 0
            ? t("library.count", { count: items.length })
            : undefined
        }
        headerRight={
          section === "history" && items.length > 0 ? (
            <IconButton
              icon={Trash2}
              label={t("library.clearHistory")}
              color={colors.danger}
              iconSize={18}
              onPress={confirmClear}
            />
          ) : undefined
        }
        onBackComplete={onBack}
      >
        <View style={styles.root}>
          {items.length === 0 ? (
            <EmptyState
              icon={EMPTY_ICON[section]}
              body={emptyText}
              style={styles.empty}
            />
          ) : (
            <FlatList
              key={section}
              ref={listRef}
              data={items}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={32}
              onScroll={(event) => {
                offsets.current[section] = event.nativeEvent.contentOffset.y;
              }}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={7}
            />
          )}
        </View>
      </SectionFrame>
    );
  },
  (previous, next) => !previous.visible && !next.visible,
);

function entryTime(item: LibraryItem): number {
  if ("savedAt" in item) return item.savedAt;
  if ("viewedAt" in item) return item.viewedAt;
  return Math.max(item.offline?.downloadedAt ?? 0, item.pdf?.downloadedAt ?? 0);
}

function downloadMeta(
  item: DownloadSummary,
  language: string,
  readerLabel: string,
): string {
  const kinds = [item.offline ? readerLabel : null, item.pdf ? "PDF" : null]
    .filter(Boolean)
    .join(" + ");
  return `${kinds} · ${formatEntryTime(entryTime(item), language)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, paddingBottom: 96 },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
});
