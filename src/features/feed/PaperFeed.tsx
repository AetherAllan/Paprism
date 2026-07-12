import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoriesSummary } from "@/features/categories/categoryLabels";
import type { Paper } from "@/types/paper";
import { LoadingScreen } from "./LoadingScreen";
import { PaperCard } from "./PaperCard";
import type { PaginationStatus } from "./usePaperFeed";

type Props = {
  papers: Paper[];
  index: number;
  onIndexChange: (index: number) => void;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  paginationStatus: PaginationStatus;
  paginationError: string | null;
  onRetry: () => void;
  categories: string[];
  onOpenCategories: () => void;
  onOpenLibrary: () => void;
  onRead: (paper: Paper) => void;
  isSaved: (arxivId: string) => boolean;
  isDownloaded: (arxivId: string) => boolean;
  downloadingId: string | null;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
};

export function PaperFeed({
  papers,
  index,
  onIndexChange,
  status,
  error,
  paginationStatus,
  paginationError,
  onRetry,
  categories,
  onOpenCategories,
  onOpenLibrary,
  onRead,
  isSaved,
  isDownloaded,
  downloadingId,
  onToggleSave,
  onDownload,
}: Props) {
  const { t, i18n } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [headerH, setHeaderH] = useState(insets.top + 48);
  const pageHeight = Math.max(windowHeight - headerH, 1);
  const activeIndex = useSharedValue(0);

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderH(e.nativeEvent.layout.height);
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onMomentumEnd: (e) => {
      const next = Math.round(e.contentOffset.y / pageHeight);
      if (next !== activeIndex.value && next >= 0) {
        activeIndex.value = next;
        runOnJS(onIndexChange)(next);
      }
    },
  });

  const getItemLayout = useCallback(
    (_: ArrayLike<Paper> | null | undefined, i: number) => ({
      length: pageHeight,
      offset: pageHeight * i,
      index: i,
    }),
    [pageHeight],
  );

  if (status === "loading" && papers.length === 0) {
    return <LoadingScreen />;
  }

  if (status === "error" && papers.length === 0) {
    return (
      <View style={[styles.center, { height: windowHeight }]}>
        <Text style={styles.errorTitle}>{t("common.loadFeedFailed")}</Text>
        <Text style={styles.errorBody}>
          {error ?? t("common.unknownError")}
        </Text>
        <Pressable style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View
        style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}
        onLayout={onHeaderLayout}
      >
        <Pressable onPress={onOpenCategories} style={styles.catBtn} hitSlop={8}>
          <Text style={styles.catLabel} numberOfLines={1}>
            {categoriesSummary(categories)}
          </Text>
          <Text style={styles.catHint}>
            {categories.length > 1
              ? t("common.selectedChange", { count: categories.length })
              : t("common.change")}
          </Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Text style={styles.counter}>
            {papers.length === 0 ? "—" : `${index + 1} / ${papers.length}`}
          </Text>
          {paginationStatus === "loading" ? (
            <Text style={styles.pageStatus}>{t("common.loadingMore")}</Text>
          ) : paginationStatus === "error" ? (
            <Pressable onPress={onRetry} hitSlop={8} accessibilityHint={paginationError ?? undefined}>
              <Text style={styles.pageError}>{t("common.retryMore")}</Text>
            </Pressable>
          ) : paginationStatus === "exhausted" ? (
            <Text style={styles.pageStatus}>{t("common.endOfFeed")}</Text>
          ) : null}
          <Pressable onPress={onOpenLibrary} hitSlop={8}>
            <Text style={styles.settings}>{t("library.title")}</Text>
          </Pressable>
        </View>
      </View>

      <Animated.FlatList
        key={`${categories.slice().sort().join("|")}-${pageHeight}-${i18n.language}`}
        data={papers}
        keyExtractor={(item) => item.arxivId}
        renderItem={({ item }) => (
          <PaperCard
            paper={item}
            height={pageHeight}
            saved={isSaved(item.arxivId)}
            downloaded={isDownloaded(item.arxivId)}
            downloading={downloadingId === item.arxivId}
            onRead={onRead}
            onToggleSave={onToggleSave}
            onDownload={onDownload}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces
        getItemLayout={getItemLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews
        style={{ height: pageHeight }}
      />
    </View>
  );
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#111113",
  },
  catBtn: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },
  catLabel: {
    color: "#f4f4f5",
    fontSize: 16,
    fontWeight: "600",
  },
  catHint: {
    color: "#71717a",
    fontSize: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  counter: {
    color: "#a1a1aa",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  pageStatus: {
    color: "#71717a",
    fontSize: 11,
  },
  pageError: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "600",
  },
  settings: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  errorTitle: {
    color: "#f4f4f5",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorBody: {
    color: "#a1a1aa",
    textAlign: "center",
    marginBottom: 20,
  },
  retry: {
    backgroundColor: "#27272a",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#f4f4f5",
    fontWeight: "600",
  },
});
