import { useState } from "react";
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
import type {
  DownloadEntry,
  HistoryEntry,
  SavedEntry,
} from "../lib/library";
import type { Paper } from "../types/paper";

type Tab = "saved" | "history" | "downloads";

type Props = {
  visible: boolean;
  saved: SavedEntry[];
  history: HistoryEntry[];
  downloads: DownloadEntry[];
  onUnsave: (arxivId: string) => void;
  onClearHistory: () => void;
  onOpenPaper: (paper: Paper) => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

export function LibraryScreen({
  visible,
  saved,
  history,
  downloads,
  onUnsave,
  onClearHistory,
  onOpenPaper,
  onOpenSettings,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("saved");

  const locale = i18n.language === "zh" ? "zh-CN" : "en";

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
          <Text style={styles.title}>{t("library.title")}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>{t("common.done")}</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {(
            [
              ["saved", t("library.tabSaved")],
              ["history", t("library.tabHistory")],
              ["downloads", t("library.tabDownloads")],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tab, tab === id && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "history" ? (
          <Pressable onPress={confirmClear} style={styles.clearRow}>
            <Text style={styles.clearText}>{t("library.clearHistory")}</Text>
          </Pressable>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {tab === "saved" &&
            (saved.length === 0 ? (
              <Text style={styles.empty}>{t("library.emptySaved")}</Text>
            ) : (
              saved.map((item) => (
                <Row
                  key={item.arxivId}
                  title={item.title}
                  subtitle={item.authors.slice(0, 2).join(", ")}
                  meta={formatTime(item.savedAt, locale)}
                  onPress={() => onOpenPaper(item)}
                  actionLabel={t("library.unsave")}
                  onAction={() => onUnsave(item.arxivId)}
                />
              ))
            ))}

          {tab === "history" &&
            (history.length === 0 ? (
              <Text style={styles.empty}>{t("library.emptyHistory")}</Text>
            ) : (
              history.map((item) => (
                <Row
                  key={`${item.arxivId}-${item.viewedAt}`}
                  title={item.title}
                  subtitle={item.authors.slice(0, 2).join(", ")}
                  meta={formatTime(item.viewedAt, locale)}
                  onPress={() => onOpenPaper(item)}
                />
              ))
            ))}

          {tab === "downloads" &&
            (downloads.length === 0 ? (
              <Text style={styles.empty}>{t("library.emptyDownloads")}</Text>
            ) : (
              downloads.map((item) => (
                <Row
                  key={item.arxivId}
                  title={item.title}
                  subtitle={item.authors.slice(0, 2).join(", ")}
                  meta={formatTime(item.downloadedAt, locale)}
                  onPress={() => onOpenPaper(item)}
                />
              ))
            ))}
        </ScrollView>

        <Pressable
          onPress={() => {
            onClose();
            onOpenSettings();
          }}
          style={styles.settingsLink}
        >
          <Text style={styles.settingsText}>{t("common.settings")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    color: "#fafafa",
    fontSize: 20,
    fontWeight: "700",
  },
  done: {
    color: "#a1a1aa",
    fontSize: 16,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#1c1c1f",
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#27272a",
  },
  tabText: {
    color: "#71717a",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#fafafa",
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
  settingsLink: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#1c1c1f",
  },
  settingsText: {
    color: "#f4f4f5",
    fontSize: 15,
    fontWeight: "600",
  },
});
