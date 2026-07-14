import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Menu from "lucide-react-native/icons/menu";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoriesSummary } from "@/features/categories/categoryLabels";
import { colors, radii } from "@/shared/theme";
import type { Paper } from "@/types/paper";
import { LoadingScreen } from "./LoadingScreen";
import { PaperCard } from "./PaperCard";
import { nearestPage, type PageDirection } from "./feedPaging";
import type { PaginationStatus } from "./usePaperFeed";

const PAGE_ANIMATION_DURATION = 125;

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
  onOpenMenu: () => void;
  onRead: (paper: Paper) => void;
  isSaved: (arxivId: string) => boolean;
  hasOfflineHtml: (arxivId: string) => boolean;
  hasPdf: (arxivId: string) => boolean;
  downloadingId: string | null;
  canCancelDownload: boolean;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
  onCancelDownload: () => void;
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
  onOpenMenu,
  onRead,
  isSaved,
  hasOfflineHtml,
  hasPdf,
  downloadingId,
  canCancelDownload,
  onToggleSave,
  onDownload,
  onCancelDownload,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useAnimatedRef<FlatList<Paper>>();
  const listReady = useSharedValue(false);
  const animatedOffset = useSharedValue(0);
  const targetIndex = useRef(index);
  const feedKey = categories.slice().sort().join("|");

  useEffect(() => {
    if (papers.length === 0) listReady.value = false;
  }, [listReady, papers.length]);

  useEffect(() => {
    targetIndex.current = index;
    if (pageHeight <= 0) return;
    cancelAnimation(animatedOffset);
    animatedOffset.value = index * pageHeight;
  }, [animatedOffset, feedKey, index, pageHeight]);

  useAnimatedReaction(
    () => animatedOffset.value,
    (offset) => {
      if (listReady.value) scrollTo(listRef, 0, offset, false);
    },
    [listReady, listRef],
  );

  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent.layout.height;
    if (measuredHeight <= 0) return;
    if (Math.abs(pageHeight - measuredHeight) < 0.5) {
      listReady.value = true;
      return;
    }
    listReady.value = false;
    setPageHeight(measuredHeight);
  }, [listReady, pageHeight]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Paper> | null | undefined, i: number) => ({
      length: pageHeight,
      offset: pageHeight * i,
      index: i,
    }),
    [pageHeight],
  );

  const finishPageAnimation = useCallback(
    (offset: number) => {
      const settled = nearestPage(offset, pageHeight, papers.length);
      targetIndex.current = settled.index;
      if (settled.index !== index) onIndexChange(settled.index);
    },
    [index, onIndexChange, pageHeight, papers.length],
  );

  const requestPage = useCallback(
    (direction: PageDirection) => {
      if (pageHeight <= 0 || papers.length === 0) return;

      const current = Math.min(
        papers.length - 1,
        Math.max(0, targetIndex.current),
      );
      const next = Math.min(
        papers.length - 1,
        Math.max(0, current + direction),
      );
      if (next === current) return;

      // Keep this ref ahead of React state while a native scroll animation is
      // running, so a second deliberate boundary swipe uses the intended page.
      targetIndex.current = next;
      const nextOffset = next * pageHeight;
      cancelAnimation(animatedOffset);
      if (reduceMotion) {
        animatedOffset.value = nextOffset;
        finishPageAnimation(nextOffset);
        return;
      }

      animatedOffset.value = withTiming(
        nextOffset,
        {
          duration: PAGE_ANIMATION_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(finishPageAnimation)(nextOffset);
        },
      );
    },
    [animatedOffset, finishPageAnimation, pageHeight, papers.length, reduceMotion],
  );

  if (status === "loading" && papers.length === 0) {
    return <LoadingScreen />;
  }

  if (status === "error" && papers.length === 0) {
    return (
      <View style={styles.center}>
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
      >
        <Pressable onPress={onOpenCategories} style={styles.catBtn} hitSlop={8}>
          <View style={styles.catIcon}>
            <SlidersHorizontal color={colors.text} size={18} strokeWidth={1.8} />
          </View>
          <View style={styles.catCopy}>
            <Text style={styles.catLabel} numberOfLines={1}>
              {categoriesSummary(categories)}
            </Text>
            <Text style={styles.catHint}>
              {categories.length > 1
                ? t("common.selectedChange", { count: categories.length })
                : t("common.change")}
            </Text>
          </View>
        </Pressable>
        <View style={styles.headerRight}>
          <View style={styles.pageMeta}>
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
          </View>
          <Pressable
            accessibilityLabel={t("menu.title")}
            onPress={onOpenMenu}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.menuButtonPressed,
            ]}
          >
            <Menu color={colors.text} size={21} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>

      <Animated.FlatList
        ref={listRef}
        key={`${feedKey}-${pageHeight}-${i18n.language}`}
        data={pageHeight > 0 ? papers : []}
        keyExtractor={(item) => item.arxivId}
        renderItem={({ item }) => (
          <PaperCard
            paper={item}
            height={pageHeight}
            saved={isSaved(item.arxivId)}
            hasOfflineHtml={hasOfflineHtml(item.arxivId)}
            hasPdf={hasPdf(item.arxivId)}
            downloading={downloadingId === item.arxivId}
            canCancelDownload={canCancelDownload}
            onRead={onRead}
            onToggleSave={onToggleSave}
            onDownload={onDownload}
            onCancelDownload={onCancelDownload}
            onPage={requestPage}
          />
        )}
        initialScrollIndex={
          pageHeight > 0 && papers.length > 0
            ? Math.min(index, papers.length - 1)
            : undefined
        }
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        onLayout={onListLayout}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  catBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 12,
  },
  catIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  catCopy: { flex: 1, gap: 2 },
  catLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  catHint: {
    color: colors.dim,
    fontSize: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pageMeta: { alignItems: "flex-end", gap: 3 },
  counter: {
    color: colors.muted,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  pageStatus: {
    color: colors.dim,
    fontSize: 11,
  },
  pageError: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "600",
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  menuButtonPressed: { backgroundColor: colors.surfacePressed },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorBody: {
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
  },
  retry: {
    backgroundColor: colors.surfacePressed,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.medium,
  },
  retryText: {
    color: colors.text,
    fontWeight: "600",
  },
});
