import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import CloudOff from "lucide-react-native/icons/cloud-off";
import Download from "lucide-react-native/icons/download";
import Menu from "lucide-react-native/icons/menu";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Tags from "lucide-react-native/icons/tags";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categoriesSummary } from "@/features/categories/categoryLabels";
import { colors, spacing, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { Paper } from "@/types/paper";
import { FeedRail } from "./FeedRail";
import { LoadingScreen } from "./LoadingScreen";
import { PaperCard } from "./PaperCard";
import { movePagerTo, type FeedPager } from "./feedPager";
import type { PageDirection } from "./feedPaging";
import type { PaginationStatus } from "./usePaperFeed";

// Height the rail must stay clear of: the card's action row plus its margins.
const RAIL_BOTTOM_CLEARANCE = 72;

type Props = {
  papers: Paper[];
  index: number;
  onIndexChange: (index: number) => void;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  offline: boolean;
  paginationStatus: PaginationStatus;
  paginationError: string | null;
  onRetry: () => void;
  categories: string[];
  onOpenCategories: () => void;
  onOpenMenu: () => void;
  onOpenDownloads: () => void;
  updateAvailable: boolean;
  onRead: (paper: Paper) => void;
  isSaved: (arxivId: string) => boolean;
  hasOfflinePaper: (arxivId: string) => boolean;
  hasPdf: (arxivId: string) => boolean;
  downloadingId: string | null;
  canCancelDownload: boolean;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
  onCancelDownload: () => void;
};

export const PaperFeed = memo(function PaperFeed({
  papers,
  index,
  onIndexChange,
  status,
  error,
  offline,
  paginationStatus,
  paginationError,
  onRetry,
  categories,
  onOpenCategories,
  onOpenMenu,
  onOpenDownloads,
  updateAvailable,
  onRead,
  isSaved,
  hasOfflinePaper,
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
  const offset = useSharedValue(0);
  const target = useSharedValue(index);
  const count = useSharedValue(papers.length);
  const height = useSharedValue(0);
  const pager = useMemo<FeedPager>(
    () => ({ offset, target, count, height }),
    [count, height, offset, target],
  );
  const feedKey = categories.slice().sort().join("|");
  const snapped = useRef({ index: -1, height: 0, key: "" });

  useEffect(() => {
    count.value = papers.length;
    if (papers.length === 0) listReady.value = false;
  }, [count, listReady, papers.length]);

  useEffect(() => {
    height.value = pageHeight;
    if (pageHeight <= 0) return;
    // A settling gesture also changes `index`, and it already put the offset in
    // the right place. Snap only for external changes such as restoring a saved
    // position or switching categories, so the next drag is never interrupted.
    const previous = snapped.current;
    if (
      previous.index === index &&
      previous.height === pageHeight &&
      previous.key === feedKey
    ) {
      return;
    }
    snapped.current = { index, height: pageHeight, key: feedKey };
    cancelAnimation(offset);
    target.value = index;
    offset.value = index * pageHeight;
  }, [feedKey, height, index, offset, pageHeight, target]);

  useAnimatedReaction(
    () => offset.value,
    (value) => {
      if (listReady.value) scrollTo(listRef, 0, Math.max(0, value), false);
    },
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measuredHeight = event.nativeEvent.layout.height;
      if (measuredHeight <= 0) return;
      if (Math.abs(pageHeight - measuredHeight) < 0.5) {
        listReady.value = true;
        return;
      }
      listReady.value = false;
      setPageHeight(measuredHeight);
    },
    [listReady, pageHeight],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Paper> | null | undefined, i: number) => ({
      length: pageHeight,
      offset: pageHeight * i,
      index: i,
    }),
    [pageHeight],
  );

  const handleSettled = useCallback(
    (settledIndex: number) => {
      snapped.current = { ...snapped.current, index: settledIndex };
      onIndexChange(settledIndex);
    },
    [onIndexChange],
  );

  const requestPage = useCallback(
    (direction: PageDirection) => {
      const lastIndex = count.value - 1;
      const next = Math.min(lastIndex, Math.max(0, target.value + direction));
      if (next === target.value || next < 0) return;
      movePagerTo(pager, next, handleSettled, reduceMotion);
    },
    [count, handleSettled, pager, reduceMotion, target],
  );

  const renderItem = useCallback(
    ({ item, index: itemIndex }: ListRenderItemInfo<Paper>) => (
      <PaperCard
        paper={item}
        index={itemIndex}
        height={pageHeight}
        pager={pager}
        saved={isSaved(item.arxivId)}
        hasOfflinePaper={hasOfflinePaper(item.arxivId)}
        hasPdf={hasPdf(item.arxivId)}
        downloading={downloadingId === item.arxivId}
        canCancelDownload={canCancelDownload}
        onRead={onRead}
        onToggleSave={onToggleSave}
        onDownload={onDownload}
        onCancelDownload={onCancelDownload}
        onSettled={handleSettled}
      />
    ),
    [
      canCancelDownload,
      downloadingId,
      handleSettled,
      hasOfflinePaper,
      hasPdf,
      isSaved,
      onCancelDownload,
      onDownload,
      onRead,
      onToggleSave,
      pageHeight,
      pager,
    ],
  );

  const atEnd = index >= papers.length - 1;

  // The header stays on every state. It holds the only route to the menu, and
  // that route must keep working offline so downloads remain reachable.
  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 2 }]}>
      <PressableScale
        accessibilityLabel={t("categories.title")}
        onPress={onOpenCategories}
        scaleTo={0.985}
        style={styles.categoryButton}
      >
        <View style={styles.headerIcon}>
          <Tags color={colors.text} size={19} strokeWidth={1.7} />
        </View>
        <View style={styles.categoryCopy}>
          <Text style={styles.categoryLabel} numberOfLines={1}>
            {categoriesSummary(categories)}
          </Text>
          <Text style={styles.categoryHint} numberOfLines={1}>
            {categories.length > 1
              ? t("common.selectedChange", { count: categories.length })
              : t("common.change")}
          </Text>
        </View>
      </PressableScale>
      {paginationStatus === "error" ? (
        <Pressable
          accessibilityHint={paginationError ?? undefined}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRetry}
        >
          <Text style={styles.pageError}>{t("common.retryMore")}</Text>
        </Pressable>
      ) : atEnd && paginationStatus === "loading" ? (
        <Text style={styles.pageStatus}>{t("common.loadingMore")}</Text>
      ) : atEnd && paginationStatus === "exhausted" ? (
        <Text style={styles.pageStatus}>{t("common.endOfFeed")}</Text>
      ) : null}
      <IconButton
        icon={Menu}
        label={t("menu.title")}
        hint={updateAvailable ? t("settings.updateAvailable") : undefined}
        badge={updateAvailable}
        onPress={onOpenMenu}
      />
    </View>
  );

  let body: React.ReactNode;
  if (papers.length === 0 && (status === "idle" || status === "loading")) {
    body = <LoadingScreen />;
  } else if (papers.length === 0 && status === "error") {
    const openWifiSettings = () => {
      void IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.WIFI_SETTINGS,
      ).catch(() => undefined);
    };
    body = (
      <EmptyState
        icon={offline ? WifiOff : CloudOff}
        title={t(offline ? "network.offlineTitle" : "common.loadFeedFailed")}
        body={
          offline
            ? t("network.offlineBody")
            : (error ?? t("common.unknownError"))
        }
        style={styles.state}
      >
        <Button
          variant="primary"
          icon={RefreshCw}
          label={t("common.retry")}
          onPress={onRetry}
        />
        {offline && Platform.OS === "android" ? (
          <Button
            icon={WifiOff}
            label={t("network.openWifi")}
            onPress={openWifiSettings}
          />
        ) : null}
        <Button
          variant="ghost"
          icon={Download}
          label={t("network.openDownloads")}
          onPress={onOpenDownloads}
        />
      </EmptyState>
    );
  } else if (papers.length === 0) {
    body = (
      <EmptyState
        icon={Tags}
        title={t(
          categories.length > 1
            ? "categories.noCommonPapers"
            : "categories.feedEmpty",
        )}
        body={t(
          categories.length > 1
            ? "categories.noCommonPapersHint"
            : "categories.feedEmptyHint",
        )}
        style={styles.state}
      >
        <Button
          variant="primary"
          label={t("categories.changeSelection")}
          onPress={onOpenCategories}
        />
      </EmptyState>
    );
  } else {
    body = (
      <>
        <Animated.FlatList
          ref={listRef}
          key={`${feedKey}-${pageHeight}-${i18n.language}`}
          data={pageHeight > 0 ? papers : []}
          keyExtractor={(item) => item.arxivId}
          renderItem={renderItem}
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
          style={styles.list}
        />
        {papers.length > 1 ? (
          <FeedRail
            pager={pager}
            count={papers.length}
            atStart={index <= 0}
            atEnd={atEnd}
            onPage={requestPage}
            bottomInset={insets.bottom + RAIL_BOTTOM_CLEARANCE}
          />
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <View style={styles.content}>{body}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  state: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.gutter - 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.highlight,
  },
  categoryCopy: { flex: 1, gap: 1 },
  categoryLabel: {
    ...typography.title,
    color: colors.text,
  },
  categoryHint: {
    ...typography.caption,
    color: colors.dim,
  },
  pageStatus: {
    ...typography.micro,
    color: colors.dim,
  },
  pageError: {
    ...typography.micro,
    color: colors.danger,
  },
});
