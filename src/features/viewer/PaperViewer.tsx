import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type ListViewToken,
  type ViewInstance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ExternalLink from "lucide-react-native/icons/external-link";
import FileText from "lucide-react-native/icons/file-text";
import ListTree from "lucide-react-native/icons/list-tree";
import MessageCircleQuestion from "lucide-react-native/icons/message-circle-question-mark";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import X from "lucide-react-native/icons/x";
import { StatusBar } from "expo-status-bar";
import { BlurTargetView } from "expo-blur";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderProfile } from "@/features/settings/providerCore";
import { resolveTranslateLang, type TranslateLangPref } from "@/lib/storage";
import { formatPaperDate } from "@/shared/format";
import { colors, motion, spacing, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { GradientFade } from "@/shared/ui/GradientFade";
import { IconButton } from "@/shared/ui/IconButton";
import { Segmented } from "@/shared/ui/Segmented";
import type { Paper } from "@/types/paper";
import { useAppDialog } from "@/shared/AppDialog";
import { AskSheet } from "@/features/ask/AskSheet";
import { useAskConversation } from "@/features/ask/useAskConversation";
import type { AskSelection, EmbeddingProfile } from "@/features/ask/askTypes";
import {
  loadReadingState,
  saveReaderPosition,
} from "@/features/ask/askDatabase";
import { ContentsSheet } from "./ContentsSheet";
import { FigureViewer } from "./FigureViewer";
import { loadPaperDocument } from "./paperSource";
import type { PaperAsset, PaperBlock, PaperDocument } from "./paperDocument";
import { ReaderBlock, type ReaderMode } from "./ReaderBlock";
import { resolveInitialReaderPosition } from "./readerPosition";
import {
  PAPER_TITLE_TRANSLATION_ID,
  useDocumentTranslation,
} from "./useDocumentTranslation";

type Props = {
  paper: Paper | null;
  translateLangPref: TranslateLangPref;
  sourceUri?: string;
  providerProfile: ProviderProfile | null;
  askEnabled: boolean;
  askProviderProfile: ProviderProfile | null;
  embeddingProfile: EmbeddingProfile | null;
  getEmbeddingApiKey: () => Promise<string | null>;
  getProviderApiKey: (profileId: string) => Promise<string | null>;
  onOpenSettings: () => void;
  onOpenAskSettings: () => void;
  onClose: () => void;
};

const BAR_HEIGHT = 56;
const BAR_FADE_HEIGHT = 22;
const DOCK_HEIGHT = 96;
// Scroll distance before the mode dock reacts, so small jitters do not toggle it.
const DOCK_SCROLL_THRESHOLD = 14;
const blockKey = (block: PaperBlock) => block.id;

function hasNativeMarkdownRenderer() {
  return (
    Platform.OS === "web" || UIManager.hasViewManagerConfig("EnrichedMarkdown")
  );
}

function openWebLink(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export const PaperViewer = memo(function PaperViewer({
  paper,
  translateLangPref,
  sourceUri,
  providerProfile,
  askEnabled,
  askProviderProfile,
  embeddingProfile,
  getEmbeddingApiKey,
  getProviderApiKey,
  onOpenSettings,
  onOpenAskSettings,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { showDialog } = useAppDialog();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [nativeReaderAvailable] = useState(hasNativeMarkdownRenderer);
  const list = useRef<FlatList<PaperBlock>>(null);
  const blurTarget = useRef<ViewInstance>(null);
  const loadController = useRef<AbortController | null>(null);
  const documentRef = useRef<PaperDocument | null>(null);
  const blockIndexRef = useRef<Map<string, number>>(new Map());
  const visibleIds = useRef<string[]>([]);
  const firstVisibleId = useRef<string | null>(null);
  const enqueueRef = useRef<(ids: string[]) => Promise<void>>(
    async () => undefined,
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 15 }).current;
  const [document, setDocument] = useState<PaperDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ReaderMode>("source");
  const [tocOpen, setTocOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [figure, setFigure] = useState<PaperAsset | null>(null);
  // Changes only when reading crosses into a new section, not on every scroll.
  const [visibleSection, setVisibleSection] = useState<string | null>(null);
  const readerPositionReady = useRef(false);
  const expectedInitialOffset = useRef(0);
  const renderStartIndexRef = useRef(0);
  const dragStartY = useRef<number | null>(null);
  const dockTarget = useRef(0);
  const [renderStartIndex, setRenderStartIndex] = useState(0);
  // Bumped to remount the list at a new starting block.
  const [listKey, setListKey] = useState(0);
  const [showPaperHeader, setShowPaperHeader] = useState(true);
  const [initialContentOffset, setInitialContentOffset] = useState<
    number | null
  >(null);
  const readerTopPadding = Math.max(insets.top, 8) + BAR_HEIGHT + 12;
  const readingProgress = useSharedValue(0);
  const dockHidden = useSharedValue(0);

  const targetLang = useMemo(
    () => resolveTranslateLang(translateLangPref),
    [translateLangPref],
  );
  const translation = useDocumentTranslation({
    active: mode !== "source",
    paper,
    document,
    providerProfile,
    targetLang,
    getProviderApiKey,
  });
  const ask = useAskConversation({
    paper,
    document,
    chatProfile: askProviderProfile,
    getChatApiKey: getProviderApiKey,
    embeddingProfile,
    getEmbeddingApiKey,
  });
  const enqueueTranslation = translation.enqueue;
  enqueueRef.current = translation.enqueue;
  documentRef.current = document;

  const headings = useMemo(
    () => document?.blocks.filter((block) => block.kind === "heading") ?? [],
    [document],
  );
  const anchorIndex = useMemo(() => {
    const result = new Map<string, number>();
    const blockIndexes = new Map<string, number>();
    document?.blocks.forEach((block, index) => {
      result.set(block.id, index);
      blockIndexes.set(block.id, index);
      for (const anchor of block.anchorIds) result.set(anchor, index);
    });
    blockIndexRef.current = blockIndexes;
    return result;
  }, [document]);
  const renderedBlocks = useMemo(
    () => document?.blocks.slice(renderStartIndex) ?? [],
    [document, renderStartIndex],
  );

  const load = useCallback(() => {
    // Retry, close, and paper changes all share one owner. A late response from
    // an older paper must never replace the currently requested document.
    loadController.current?.abort();
    loadController.current = null;
    readerPositionReady.current = false;
    expectedInitialOffset.current = 0;
    renderStartIndexRef.current = 0;
    firstVisibleId.current = null;
    visibleIds.current = [];
    dragStartY.current = null;
    dockTarget.current = 0;
    setRenderStartIndex(0);
    setShowPaperHeader(true);
    setInitialContentOffset(null);
    setVisibleSection(null);
    setFigure(null);
    setTocOpen(false);
    readingProgress.value = 0;
    dockHidden.value = 0;
    if (!paper || !nativeReaderAvailable) {
      setDocument(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setLoadError(null);
    setMode("source");
    setDocument(null);
    void Promise.all([
      loadPaperDocument(paper, sourceUri, controller.signal),
      loadReadingState(paper.arxivId).catch(() => null),
    ])
      .then(([nextDocument, readingState]) => {
        if (
          loadController.current === controller &&
          !controller.signal.aborted
        ) {
          const initial = resolveInitialReaderPosition(
            nextDocument,
            readingState,
          );
          const hasSavedBlock = initial.blockId !== null;
          const contentOffset = hasSavedBlock ? readerTopPadding : 0;

          // The first FlatList mount starts at the saved semantic block. This
          // avoids rendering Summary and then racing a scroll command against
          // dynamic Markdown measurement.
          renderStartIndexRef.current = initial.blockIndex;
          setRenderStartIndex(initial.blockIndex);
          setShowPaperHeader(!hasSavedBlock);
          setInitialContentOffset(hasSavedBlock ? contentOffset : null);
          expectedInitialOffset.current = contentOffset;
          firstVisibleId.current = initial.blockId;
          readerPositionReady.current = !hasSavedBlock;
          setDocument(nextDocument);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (loadController.current !== controller) return;
        setLoadError(
          error instanceof Error ? error.message : t("common.unknownError"),
        );
      })
      .finally(() => {
        if (loadController.current === controller) {
          loadController.current = null;
          if (!controller.signal.aborted) setLoading(false);
        }
      });
    return () => {
      controller.abort();
      if (loadController.current === controller) loadController.current = null;
    };
  }, [
    dockHidden,
    nativeReaderAvailable,
    paper,
    readerTopPadding,
    readingProgress,
    sourceUri,
    t,
  ]);

  useEffect(load, [load]);

  useEffect(() => {
    if (mode === "source" || !document) return;
    const ids =
      visibleIds.current.length > 0
        ? visibleIds.current
        : document.blocks.slice(0, 8).map((block) => block.id);
    void enqueueTranslation([PAPER_TITLE_TRANSLATION_ID, ...ids]);
  }, [document, enqueueTranslation, mode]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
      const currentDocument = documentRef.current;
      if (!currentDocument) return;
      const indexes = viewableItems
        .map((item) => blockIndexRef.current.get(item.item.id))
        .filter((index): index is number => index !== undefined);
      if (indexes.length === 0) return;
      const visibleFirst = Math.min(...indexes);
      const first = Math.max(0, visibleFirst - 1);
      const last = Math.min(
        currentDocument.blocks.length - 1,
        Math.max(...indexes) + 3,
      );
      const ids = currentDocument.blocks
        .slice(first, last + 1)
        .map((block) => block.id);
      visibleIds.current = ids;
      const block = currentDocument.blocks[visibleFirst];
      firstVisibleId.current = block?.id ?? null;
      setVisibleSection(
        block?.kind === "heading"
          ? block.plainText
          : (block?.sectionTitle ?? null),
      );
      readingProgress.value = withTiming(
        currentDocument.blocks.length > 1
          ? visibleFirst / (currentDocument.blocks.length - 1)
          : 1,
        { duration: motion.baseMs },
      );
      void enqueueRef.current(ids);
    },
  ).current;

  const persistReaderPosition = useCallback(() => {
    if (!paper || !document || !readerPositionReady.current) return;
    const blockId = firstVisibleId.current;
    if (!blockId) return;

    // Dynamic native Markdown does not expose stable per-cell geometry. The
    // semantic block is the durable position; guessed pixels recreate the
    // same restore race this path is meant to remove.
    void saveReaderPosition(paper.arxivId, blockId).catch(() => {
      // Reading memory is optional; leaving the reader must always succeed.
    });
  }, [document, paper]);

  const revealWholeDocument = useCallback(() => {
    if (renderStartIndexRef.current === 0 && showPaperHeader) return;
    // Native maintainVisibleContentPosition keeps the current paragraph still
    // while the omitted prefix becomes available for upward scrolling.
    renderStartIndexRef.current = 0;
    setInitialContentOffset(null);
    setRenderStartIndex(0);
    setShowPaperHeader(true);
  }, [showPaperHeader]);

  /**
   * Start the list at a block, the same way a saved position is restored.
   * Cells have dynamic Markdown heights, so a scroll offset for an unmeasured
   * block can only be a guess. Starting from the block itself is always exact.
   */
  const jumpToBlock = useCallback(
    (index: number) => {
      const block = documentRef.current?.blocks[index];
      if (!block) return;
      const atStart = index === 0;
      const offset = atStart ? 0 : readerTopPadding;
      renderStartIndexRef.current = index;
      expectedInitialOffset.current = offset;
      firstVisibleId.current = block.id;
      readerPositionReady.current = true;
      dragStartY.current = null;
      dockTarget.current = 0;
      dockHidden.value = 0;
      setRenderStartIndex(index);
      setShowPaperHeader(atStart);
      setInitialContentOffset(atStart ? null : offset);
      setListKey((key) => key + 1);
    },
    [dockHidden, readerTopPadding],
  );

  const scrollToDocumentIndex = useCallback(
    (index: number) => {
      const renderedIndex = index - renderStartIndexRef.current;
      // A block before the list's start cannot be scrolled to at all.
      if (renderedIndex < 0) {
        jumpToBlock(index);
        return;
      }
      // Nearby blocks are already measured, so this one animates. Anything else
      // lands in onScrollToIndexFailed and jumps instead.
      list.current?.scrollToIndex({
        index: renderedIndex,
        animated: true,
        // Land the target directly below the floating bar.
        viewOffset: readerTopPadding + 4,
        viewPosition: 0,
      });
    },
    [jumpToBlock, readerTopPadding],
  );

  const onScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      jumpToBlock(index + renderStartIndexRef.current);
    },
    [jumpToBlock],
  );

  const closeViewer = useCallback(() => {
    persistReaderPosition();
    setAskOpen(false);
    onClose();
  }, [onClose, persistReaderPosition]);

  // An Android Modal is its own window: the hardware back key reaches only this
  // handler, never BackHandler. Layers inside the modal must be closed from here
  // or back would dismiss the entire reader.
  const handleRequestClose = useCallback(() => {
    if (askOpen) setAskOpen(false);
    else closeViewer();
  }, [askOpen, closeViewer]);

  const setAskSelection = ask.setSelection;
  const openAsk = useCallback(
    (selection?: AskSelection) => {
      // The toolbar entry intentionally asks about the current viewport. Only
      // the native selection action should retain an explicit quoted passage.
      setAskSelection(selection ?? null);
      setAskOpen(true);
    },
    [setAskSelection],
  );

  const openLink = useCallback(
    ({ url }: { url: string }) => {
      const prefix = "paprism://anchor/";
      if (url.startsWith(prefix)) {
        const anchor = decodeURIComponent(url.slice(prefix.length));
        const index = anchorIndex.get(anchor);
        if (index !== undefined) {
          scrollToDocumentIndex(index);
        }
        return;
      }
      if (/^https?:/i.test(url)) openWebLink(url);
    },
    [anchorIndex, scrollToDocumentIndex],
  );

  const showTranslationSetup = useCallback(() => {
    showDialog({
      title: t("translation.setupTitle"),
      message: t("translation.setupBody"),
      actions: [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.settings"), onPress: onOpenSettings },
      ],
    });
  }, [onOpenSettings, showDialog, t]);

  const changeMode = useCallback(
    async (next: ReaderMode) => {
      if (next !== "source" && mode === "source") {
        if (!providerProfile) {
          showTranslationSetup();
          return;
        }
        let hasKey = providerProfile.kind === "google";
        if (!hasKey) {
          try {
            hasKey = Boolean(await getProviderApiKey(providerProfile.id));
          } catch {
            hasKey = false;
          }
        }
        if (!hasKey) {
          showTranslationSetup();
          return;
        }
      }
      setMode(next);
    },
    [getProviderApiKey, mode, providerProfile, showTranslationSetup],
  );

  const modeOptions = useMemo(
    () =>
      [
        { id: "source", label: t("common.original") },
        { id: "dual", label: t("translation.dual") },
        { id: "translation", label: t("translation.translationOnly") },
      ] as const,
    [t],
  );

  const askAvailable = askEnabled && Platform.OS === "android";
  const arxivId = paper?.arxivId ?? "";
  const translations = translation.translations;
  const renderBlock = useCallback(
    ({ item }: ListRenderItemInfo<PaperBlock>) => (
      <ReaderBlock
        block={item}
        mode={mode}
        translation={translations[item.id]}
        onLinkPress={openLink}
        askEnabled={askAvailable}
        arxivId={arxivId}
        onAsk={openAsk}
        onOpenFigure={setFigure}
      />
    ),
    [arxivId, askAvailable, mode, openAsk, openLink, translations],
  );

  const setDockHidden = useCallback(
    (hidden: boolean) => {
      const next = hidden ? 1 : 0;
      if (dockTarget.current === next) return;
      dockTarget.current = next;
      dockHidden.value = reduceMotion
        ? next
        : withTiming(next, {
            duration: motion.fastMs,
            easing: Easing.out(Easing.cubic),
          });
    },
    [dockHidden, reduceMotion],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const offset = contentOffset.y;
      if (
        !readerPositionReady.current &&
        Math.abs(offset - expectedInitialOffset.current) > 2
      ) {
        return;
      }
      readerPositionReady.current = true;

      // Give the page back while reading forward, and return the controls on
      // any move back up or on reaching the end of the paper.
      const atEnd =
        contentSize.height - layoutMeasurement.height - offset < DOCK_HEIGHT;
      if (atEnd) {
        setDockHidden(false);
        return;
      }
      // Only finger travel counts. Measuring or inserting blocks above the
      // viewport also shifts the offset, and that is not a scroll direction.
      const dragStart = dragStartY.current;
      if (dragStart === null) return;
      const travel = offset - dragStart;
      if (Math.abs(travel) < DOCK_SCROLL_THRESHOLD) return;
      setDockHidden(travel > 0);
    },
    [setDockHidden],
  );

  const dockStyle = useAnimatedStyle(() => ({
    opacity: 1 - dockHidden.value,
    transform: [{ translateY: dockHidden.value * DOCK_HEIGHT * 0.7 }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (readingProgress.value - 1) * windowWidth }],
  }));

  const contentContainerStyle = useMemo(
    () => ({
      // A list started at a saved or jumped-to block opens scrolled down by one
      // padding, so an upward drag can begin and reveal the earlier blocks. The
      // extra padding keeps that first block below the bar instead of under it.
      paddingTop: showPaperHeader ? readerTopPadding : readerTopPadding * 2,
      paddingHorizontal: spacing.gutter,
      paddingBottom: Math.max(insets.bottom, 16) + DOCK_HEIGHT,
    }),
    [insets.bottom, readerTopPadding, showPaperHeader],
  );

  const paperHeader = useMemo(
    () =>
      showPaperHeader && paper ? (
        <PaperHeader
          paper={paper}
          mode={mode}
          translation={translations[PAPER_TITLE_TRANSLATION_ID]}
        />
      ) : null,
    [mode, paper, showPaperHeader, translations],
  );

  const contentOffset = useMemo(
    () =>
      initialContentOffset === null
        ? undefined
        : { x: 0, y: initialContentOffset },
    [initialContentOffset],
  );

  const getVisibleBlockId = useCallback(() => firstVisibleId.current, []);
  const closeAsk = useCallback(() => setAskOpen(false), []);
  const closeToc = useCallback(() => setTocOpen(false), []);
  const closeFigure = useCallback(() => setFigure(null), []);
  const openAskSettings = useCallback(() => {
    setAskOpen(false);
    onOpenAskSettings();
  }, [onOpenAskSettings]);
  const navigateToSource = useCallback(
    (blockId: string) => {
      const index = blockIndexRef.current.get(blockId);
      if (index === undefined) return;
      setAskOpen(false);
      scrollToDocumentIndex(index);
    },
    [scrollToDocumentIndex],
  );
  const selectHeading = useCallback(
    (id: string) => {
      const index = anchorIndex.get(id);
      setTocOpen(false);
      if (index !== undefined) scrollToDocumentIndex(index);
    },
    [anchorIndex, scrollToDocumentIndex],
  );

  const translating = mode !== "source";
  const pending = translation.progress.pending;

  return (
    <Modal
      visible={paper != null}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.root}>
        <StatusBar style="light" />
        <BlurTargetView ref={blurTarget} style={styles.root}>
          {nativeReaderAvailable && document && paper ? (
            <FlatList
              key={listKey}
              ref={list}
              data={renderedBlocks}
              keyExtractor={blockKey}
              renderItem={renderBlock}
              contentOffset={contentOffset}
              maintainVisibleContentPosition={MAINTAIN_POSITION}
              contentContainerStyle={contentContainerStyle}
              ListHeaderComponent={paperHeader ?? undefined}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              updateCellsBatchingPeriod={40}
              windowSize={7}
              onScrollToIndexFailed={onScrollToIndexFailed}
              onScroll={handleScroll}
              onScrollBeginDrag={(event) => {
                readerPositionReady.current = true;
                // The drag that reveals the earlier blocks shifts the offset
                // by their whole height, so it says nothing about direction.
                const revealing =
                  renderStartIndexRef.current !== 0 || !showPaperHeader;
                dragStartY.current = revealing
                  ? null
                  : event.nativeEvent.contentOffset.y;
                revealWholeDocument();
              }}
              onMomentumScrollEnd={persistReaderPosition}
              onScrollEndDrag={() => {
                dragStartY.current = null;
                persistReaderPosition();
              }}
              scrollEventThrottle={100}
              showsVerticalScrollIndicator={false}
            />
          ) : null}

          {!nativeReaderAvailable ? (
            <EmptyState
              icon={TriangleAlert}
              title={t("reader.devClientTitle")}
              body={t("reader.devClientBody")}
              style={styles.center}
            >
              <Button
                variant="primary"
                label={t("common.close")}
                onPress={closeViewer}
              />
            </EmptyState>
          ) : null}

          {nativeReaderAvailable && loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>{t("reader.loading")}</Text>
            </View>
          ) : null}

          {nativeReaderAvailable && !loading && loadError && paper ? (
            <EmptyState
              icon={TriangleAlert}
              tone="danger"
              title={t("reader.unavailable")}
              body={loadError}
              style={styles.center}
            >
              <Button
                variant="primary"
                icon={RefreshCw}
                label={t("common.retry")}
                onPress={() => void load()}
              />
              <Button
                icon={FileText}
                label={t("reader.openPdf")}
                onPress={() => openWebLink(paper.pdfUrl)}
              />
              <Button
                icon={ExternalLink}
                label={t("reader.openArxiv")}
                onPress={() =>
                  openWebLink(`https://arxiv.org/abs/${paper.arxivId}`)
                }
              />
            </EmptyState>
          ) : null}

          <View pointerEvents="box-none" style={styles.barLayer}>
            <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
              <IconButton
                icon={ArrowLeft}
                label={t("common.back")}
                onPress={closeViewer}
              />
              <View style={styles.barCopy}>
                <Text style={styles.barId} numberOfLines={1}>
                  {paper ? `arXiv:${paper.arxivId}` : "Paprism"}
                </Text>
                <Text style={styles.barSection} numberOfLines={1}>
                  {visibleSection ?? paper?.title ?? ""}
                </Text>
              </View>
              {askAvailable && nativeReaderAvailable ? (
                <IconButton
                  icon={MessageCircleQuestion}
                  color={colors.accent}
                  label={t("menu.ask")}
                  onPress={() => openAsk()}
                />
              ) : null}
              {headings.length > 0 ? (
                <IconButton
                  icon={ListTree}
                  color={colors.textSecondary}
                  label={t("reader.contents")}
                  onPress={() => setTocOpen(true)}
                />
              ) : null}
            </View>
            {document ? (
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, progressStyle]} />
              </View>
            ) : null}
            <GradientFade height={BAR_FADE_HEIGHT} />
          </View>

          {nativeReaderAvailable && document ? (
            <Animated.View
              pointerEvents="box-none"
              style={[styles.dock, dockStyle]}
            >
              <GradientFade
                direction="up"
                height={DOCK_HEIGHT + Math.max(insets.bottom, 10)}
                style={styles.dockFade}
              />
              <View
                pointerEvents="box-none"
                style={[
                  styles.dockContent,
                  { paddingBottom: Math.max(insets.bottom, 10) + 8 },
                ]}
              >
                {translating && translation.error ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={translation.retryFailed}
                    style={styles.statusPill}
                  >
                    <Text style={styles.statusError} numberOfLines={1}>
                      {translation.error} · {t("translation.retryFailed")}
                    </Text>
                  </Pressable>
                ) : translating && pending > 0 ? (
                  <View style={styles.statusPill}>
                    <ActivityIndicator color={colors.accent} size={12} />
                    <Text style={styles.statusText} numberOfLines={1}>
                      {translation.progress.completed}/
                      {translation.total || "—"}
                      {providerProfile ? ` · ${providerProfile.name}` : ""}
                    </Text>
                    <IconButton
                      plain
                      icon={X}
                      iconSize={13}
                      color={colors.muted}
                      label={t("common.cancel")}
                      onPress={translation.cancel}
                      size={22}
                    />
                  </View>
                ) : null}
                <Segmented
                  options={modeOptions}
                  value={mode}
                  onChange={(next) => void changeMode(next)}
                  style={styles.modeControl}
                />
              </View>
            </Animated.View>
          ) : null}

          <ContentsSheet
            visible={tocOpen}
            headings={headings}
            activeSection={visibleSection}
            onClose={closeToc}
            onSelect={selectHeading}
          />
          <FigureViewer asset={figure} onClose={closeFigure} />
        </BlurTargetView>
        <AskSheet
          visible={askOpen}
          conversation={ask}
          chatProfile={askProviderProfile}
          getVisibleBlockId={getVisibleBlockId}
          onClose={closeAsk}
          onNavigateToSource={navigateToSource}
          onOpenSettings={openAskSettings}
          blurTarget={blurTarget}
        />
      </View>
    </Modal>
  );
});

const MAINTAIN_POSITION = { minIndexForVisible: 0 };

const PaperHeader = memo(function PaperHeader({
  paper,
  mode,
  translation,
}: {
  paper: Paper;
  mode: ReaderMode;
  translation?: string;
}) {
  const { t, i18n } = useTranslation();
  const date = formatPaperDate(paper.published, i18n.language);
  const categories = paper.categories.slice(0, 4).join(" · ");
  return (
    <View style={styles.paperHeader}>
      {date ? <Text style={styles.paperDate}>{date}</Text> : null}
      {categories ? (
        <Text style={styles.paperCategories}>{categories}</Text>
      ) : null}
      <Text selectable style={styles.paperTitle}>
        {mode === "translation" && translation ? translation : paper.title}
      </Text>
      {mode === "dual" && translation ? (
        <Text selectable style={styles.translatedPaperTitle}>
          {translation}
        </Text>
      ) : null}
      <Text selectable style={styles.authors}>
        {paper.authors.join(" · ")}
      </Text>
      <View style={styles.paperLinks}>
        <Button
          size="small"
          icon={FileText}
          label="PDF"
          accessibilityLabel={t("reader.openPdf")}
          onPress={() => openWebLink(paper.pdfUrl)}
        />
        <Button
          size="small"
          icon={ExternalLink}
          label="arXiv"
          accessibilityLabel={t("reader.openArxiv")}
          onPress={() => openWebLink(`https://arxiv.org/abs/${paper.arxivId}`)}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  barLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.gutter - 6,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  barCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  barId: {
    ...typography.micro,
    ...typography.numeric,
    color: colors.dim,
  },
  barSection: {
    ...typography.label,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  progressTrack: {
    height: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  progressFill: {
    flex: 1,
    backgroundColor: colors.accent,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: colors.background,
  },
  loadingText: { ...typography.body, color: colors.muted, marginTop: 14 },
  paperHeader: {
    paddingBottom: 22,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  paperDate: {
    ...typography.caption,
    color: colors.dim,
    marginBottom: 6,
  },
  paperCategories: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 14,
  },
  paperTitle: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 35,
    color: colors.text,
  },
  translatedPaperTitle: {
    ...typography.headline,
    fontSize: 22,
    lineHeight: 29,
    color: colors.translated,
    marginTop: 10,
  },
  authors: {
    ...typography.body,
    color: colors.muted,
    marginTop: 12,
  },
  paperLinks: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  dockFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockContent: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.gutter,
  },
  modeControl: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 300,
  },
  statusPill: {
    maxWidth: "100%",
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusText: {
    ...typography.micro,
    ...typography.numeric,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  statusError: { ...typography.micro, flexShrink: 1, color: colors.danger },
});
