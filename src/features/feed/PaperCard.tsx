import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Bookmark from "lucide-react-native/icons/bookmark";
import BookmarkCheck from "lucide-react-native/icons/bookmark-check";
import BookOpen from "lucide-react-native/icons/book-open";
import Download from "lucide-react-native/icons/download";
import FileCheck from "lucide-react-native/icons/file-check";
import X from "lucide-react-native/icons/x";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatAuthors, formatPaperDate } from "@/shared/format";
import { colors, radii, spacing, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { GradientFade } from "@/shared/ui/GradientFade";
import type { Paper } from "@/types/paper";
import {
  loadReadingState,
  saveFeedReadingOffset,
} from "@/features/ask/askDatabase";
import { movePagerTo, type FeedPager } from "./feedPager";
import { pageDirectionForGesture, pageDragOffset } from "./feedPaging";

type Props = {
  paper: Paper;
  index: number;
  height: number;
  pager: FeedPager;
  saved: boolean;
  downloading: boolean;
  canCancelDownload: boolean;
  hasOfflinePaper: boolean;
  hasPdf: boolean;
  onRead: (paper: Paper) => void;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
  onCancelDownload: () => void;
  onSettled: (index: number) => void;
};

const BOUNDARY_TOLERANCE = 2;
const BODY_FADE_HEIGHT = 36;
// Offsets closer than this to the saved value are not worth a database write.
const OFFSET_WRITE_THRESHOLD = 4;
// How far the outgoing card scales back while the next one covers it.
const RECEDE_SCALE = 0.06;
const RECEDE_OPACITY = 0.72;
const RECEDE_FOLLOW = 0.86;

export const PaperCard = memo(function PaperCard({
  paper,
  index,
  height,
  pager,
  saved,
  downloading,
  canCancelDownload,
  hasOfflinePaper,
  hasPdf,
  onRead,
  onToggleSave,
  onDownload,
  onCancelDownload,
  onSettled,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const bodyRef = useRef<ScrollView>(null);
  const pendingRestore = useRef<number | null>(null);
  const hydrated = useRef(false);
  const lastPersisted = useRef(0);

  const bodyOffset = useSharedValue(0);
  const bodyContentHeight = useSharedValue(0);
  const bodyViewportHeight = useSharedValue(0);
  const startedAtTop = useSharedValue(true);
  const startedAtBottom = useSharedValue(true);
  const dragDirection = useSharedValue<-1 | 0 | 1>(0);
  const dragLocked = useSharedValue(false);
  const dragStartOffset = useSharedValue(0);

  const date = useMemo(
    () => formatPaperDate(paper.published, i18n.language),
    [i18n.language, paper.published],
  );
  const authorLine = useMemo(
    () => formatAuthors(paper.authors),
    [paper.authors],
  );
  const categoryLine = useMemo(
    () => paper.categories.slice(0, 4).join(" · "),
    [paper.categories],
  );

  const handleBodyLayout = (event: LayoutChangeEvent) => {
    bodyViewportHeight.value = event.nativeEvent.layout.height;
  };

  const handleBodyScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      bodyOffset.value = event.contentOffset.y;
    },
  });

  const persistBodyOffset = useCallback(() => {
    // Cards mount and unmount constantly as the feed virtualizes. Writing only
    // real changes keeps untouched papers out of the database, and waiting for
    // hydration stops an early unmount from overwriting a saved offset with 0.
    if (!hydrated.current) return;
    const offset = Math.round(bodyOffset.value);
    if (Math.abs(offset - lastPersisted.current) < OFFSET_WRITE_THRESHOLD) {
      return;
    }
    lastPersisted.current = offset;
    void saveFeedReadingOffset(paper.arxivId, offset).catch(() => {
      // Reading memory is best-effort and must never affect paper browsing.
    });
  }, [bodyOffset, paper.arxivId]);

  useEffect(() => {
    let cancelled = false;
    void loadReadingState(paper.arxivId)
      .then((state) => {
        if (cancelled) return;
        hydrated.current = true;
        if (!state || state.feedOffset <= 0) return;
        lastPersisted.current = state.feedOffset;
        bodyOffset.value = state.feedOffset;
        pendingRestore.current = state.feedOffset;
        bodyRef.current?.scrollTo({ y: state.feedOffset, animated: false });
      })
      .catch(() => {
        if (!cancelled) hydrated.current = true;
      });
    return () => {
      cancelled = true;
      persistBodyOffset();
    };
  }, [bodyOffset, paper.arxivId, persistBodyOffset]);

  const { nativeScrollGesture, pageGesture } = useMemo(() => {
    // React Native's touch-end callback is not reliable once Android's native
    // ScrollView becomes the responder. A simultaneous native/pan gesture keeps
    // abstract scrolling native while still observing the complete swipe.
    const nativeScrollGesture = Gesture.Native();
    // Lock direction once, on the first real movement. onStart cannot do this:
    // the handler reports a translation of 0 when it activates. A drag that
    // begins as abstract scrolling also stays abstract scrolling, even if the
    // finger later reverses past its origin.
    const lockDirection = (translationY: number) => {
      "worklet";
      if (dragLocked.value || translationY === 0) return;
      dragLocked.value = true;
      const direction = translationY < 0 ? 1 : -1;
      const allowed =
        direction === 1 ? startedAtBottom.value : startedAtTop.value;
      if (!allowed) return;
      dragDirection.value = direction;
      cancelAnimation(pager.offset);
      dragStartOffset.value = pager.offset.value;
    };
    const pageGesture = Gesture.Pan()
      .simultaneousWithExternalGesture(nativeScrollGesture)
      .activeOffsetY([-10, 10])
      .failOffsetX([-28, 28])
      .onBegin(() => {
        // Snapshot the boundary at touch-down. Recomputing it later would let
        // one swipe both finish scrolling the abstract and turn the page.
        const maxOffset = Math.max(
          0,
          bodyContentHeight.value - bodyViewportHeight.value,
        );
        startedAtTop.value = bodyOffset.value <= BOUNDARY_TOLERANCE;
        startedAtBottom.value =
          maxOffset <= BOUNDARY_TOLERANCE ||
          bodyOffset.value >= maxOffset - BOUNDARY_TOLERANCE;
        dragDirection.value = 0;
        dragLocked.value = false;
      })
      .onUpdate((event) => {
        lockDirection(event.translationY);
        const direction = dragDirection.value;
        if (direction === 0) return;
        pager.offset.value = pageDragOffset({
          startOffset: dragStartOffset.value,
          travelY: event.translationY,
          direction,
          pageHeight: pager.height.value,
          itemCount: pager.count.value,
        });
      })
      .onEnd((event) => {
        // A very fast flick can end before the first update arrives.
        lockDirection(event.translationY);
        const direction = dragDirection.value;
        dragDirection.value = 0;
        if (direction === 0) return;
        const decided = pageDirectionForGesture({
          dx: event.translationX,
          dy: event.translationY,
          startedAtTop: direction === -1,
          startedAtBottom: direction === 1,
          velocityY: event.velocityY,
        });
        const lastIndex = Math.max(0, pager.count.value - 1);
        const next = Math.min(
          lastIndex,
          Math.max(0, pager.target.value + decided),
        );
        movePagerTo(pager, next, onSettled, reduceMotion);
      })
      .onFinalize((_event, succeeded) => {
        // A system cancellation must not leave the feed between two pages.
        if (succeeded || dragDirection.value === 0) return;
        dragDirection.value = 0;
        movePagerTo(pager, pager.target.value, onSettled, reduceMotion);
      });
    return { nativeScrollGesture, pageGesture };
  }, [
    bodyContentHeight,
    bodyOffset,
    bodyViewportHeight,
    dragDirection,
    dragLocked,
    dragStartOffset,
    onSettled,
    pager,
    reduceMotion,
    startedAtBottom,
    startedAtTop,
  ]);

  // Cards share one offset. The outgoing card stays pinned and recedes while
  // the next card slides over it, like the stack of pages in the brand mark.
  const depthStyle = useAnimatedStyle(() => {
    const pageHeight = pager.height.value;
    if (pageHeight <= 0) return {};
    const lastOffset = Math.max(0, pager.count.value - 1) * pageHeight;
    const offset = pager.offset.value;
    const clamped = Math.min(lastOffset, Math.max(0, offset));
    // Native scrolling clamps at the feed's ends, so the card itself moves to
    // show the resistance of an overscroll.
    const overscroll = offset - clamped;
    const position = (clamped - index * pageHeight) / pageHeight;
    const recede = reduceMotion || position <= 0 ? 0 : Math.min(1, position);
    return {
      // A fully covered card is hidden. It would otherwise show through the
      // rounded corners of the card on top, and cost overdraw at rest.
      opacity: recede >= 1 ? 0 : 1 - RECEDE_OPACITY * recede,
      transform: [
        { translateY: recede * pageHeight * RECEDE_FOLLOW - overscroll },
        { scale: 1 - RECEDE_SCALE * recede },
      ],
    };
  });

  // The leading edge of a card is only visible while it is moving.
  const edgeStyle = useAnimatedStyle(() => {
    const pageHeight = pager.height.value;
    if (pageHeight <= 0) return { opacity: 0 };
    const position = (pager.offset.value - index * pageHeight) / pageHeight;
    return { opacity: Math.min(1, Math.abs(position) * 12) };
  });

  const bodyFadeStyle = useAnimatedStyle(() => {
    const remaining =
      bodyContentHeight.value - bodyViewportHeight.value - bodyOffset.value;
    return { opacity: Math.min(1, Math.max(0, remaining / BODY_FADE_HEIGHT)) };
  });

  const downloadLabel = downloading
    ? canCancelDownload
      ? t("common.cancel")
      : t("common.downloading")
    : hasOfflinePaper
      ? t("common.offlineRead")
      : hasPdf
        ? t("common.pdfSaved")
        : t("common.download");
  const downloadIcon =
    downloading && canCancelDownload
      ? X
      : hasOfflinePaper || hasPdf
        ? FileCheck
        : Download;

  return (
    <Animated.View
      style={[
        styles.shell,
        { height, paddingBottom: insets.bottom + 14 },
        depthStyle,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.edge, edgeStyle]} />
      <GestureDetector gesture={pageGesture}>
        <GestureDetector gesture={nativeScrollGesture}>
          <Animated.ScrollView
            ref={bodyRef as never}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            scrollEventThrottle={16}
            onLayout={handleBodyLayout}
            onContentSizeChange={(_width, contentHeight) => {
              bodyContentHeight.value = contentHeight;
              if (pendingRestore.current !== null) {
                bodyRef.current?.scrollTo({
                  y: pendingRestore.current,
                  animated: false,
                });
                pendingRestore.current = null;
              }
            }}
            onScroll={handleBodyScroll}
            onMomentumScrollEnd={persistBodyOffset}
            onScrollEndDrag={persistBodyOffset}
          >
            {date ? <Text style={styles.date}>{date}</Text> : null}
            {categoryLine ? (
              <Text style={styles.categories} numberOfLines={2}>
                {categoryLine}
              </Text>
            ) : null}

            <Text style={styles.title}>{paper.title}</Text>
            {authorLine ? (
              <Text style={styles.authors}>{authorLine}</Text>
            ) : null}
            <Text style={styles.arxivId}>{paper.arxivId}</Text>

            <Text style={styles.sectionLabel}>{t("common.abstract")}</Text>
            <Text style={styles.abstract}>{paper.abstract}</Text>
          </Animated.ScrollView>
        </GestureDetector>
      </GestureDetector>

      <View style={styles.footer}>
        <Animated.View
          pointerEvents="none"
          style={[styles.bodyFade, bodyFadeStyle]}
        >
          <GradientFade direction="up" height={BODY_FADE_HEIGHT} />
        </Animated.View>
        <View style={styles.actions}>
          <Button
            variant="primary"
            icon={BookOpen}
            label={t("common.read")}
            onPress={() => onRead(paper)}
            style={styles.readAction}
          />
          <Button
            icon={saved ? BookmarkCheck : Bookmark}
            iconColor={saved ? colors.accent : undefined}
            label={saved ? t("common.saved") : t("common.save")}
            onPress={() => onToggleSave(paper)}
            style={styles.action}
          />
          <Button
            icon={downloadIcon}
            label={downloadLabel}
            loading={downloading && !canCancelDownload}
            onPress={() =>
              downloading && canCancelDownload
                ? onCancelDownload()
                : onDownload(paper)
            }
            style={styles.action}
          />
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    paddingHorizontal: spacing.gutter,
    paddingTop: 18,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xlarge,
    borderTopRightRadius: radii.xlarge,
  },
  edge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: radii.xlarge,
    borderTopLeftRadius: radii.xlarge,
    borderTopRightRadius: radii.xlarge,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.highlight,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingRight: spacing.railGutter - spacing.gutter,
    paddingBottom: BODY_FADE_HEIGHT,
  },
  date: {
    ...typography.caption,
    color: colors.dim,
    marginBottom: 6,
  },
  categories: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 16,
  },
  title: {
    ...typography.display,
    color: colors.text,
    marginBottom: 14,
  },
  authors: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  arxivId: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.dim,
    marginBottom: 22,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.dim,
    marginBottom: 8,
  },
  abstract: {
    ...typography.reading,
    color: colors.textSecondary,
  },
  footer: {
    paddingTop: 4,
  },
  bodyFade: {
    position: "absolute",
    top: -BODY_FADE_HEIGHT,
    left: 0,
    right: spacing.railGutter - spacing.gutter,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  readAction: { flex: 1.25 },
  action: { flex: 1 },
});
