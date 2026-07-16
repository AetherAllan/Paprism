import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type ListRenderItemInfo,
  type ViewToken,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Languages from "lucide-react-native/icons/languages";
import ListTree from "lucide-react-native/icons/list-tree";
import MessageCircleQuestion from "lucide-react-native/icons/message-circle-question-mark";
import X from "lucide-react-native/icons/x";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import { SvgUri } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { BlurTargetView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderProfile } from "@/features/settings/providerCore";
import { resolveTranslateLang, type TranslateLangPref } from "@/lib/storage";
import { colors, radii } from "@/shared/theme";
import type { Paper } from "@/types/paper";
import { AskSheet } from "@/features/ask/AskSheet";
import { useAskConversation } from "@/features/ask/useAskConversation";
import type { AskSelection, EmbeddingProfile } from "@/features/ask/askTypes";
import {
  loadReadingState,
  saveReaderPosition,
} from "@/features/ask/askDatabase";
import { loadPaperDocument } from "./paperSource";
import type { PaperAsset, PaperBlock, PaperDocument } from "./paperDocument";
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

type Mode = "source" | "dual" | "translation";
const ignoreImageError = () => undefined;
const accent = colors.accent;
const accentStrong = "#8b5cf6";
const translatedText = "#ddd6fe";

function hasNativeMarkdownRenderer() {
  return (
    Platform.OS === "web" || UIManager.hasViewManagerConfig("EnrichedMarkdown")
  );
}

const MARKDOWN_STYLE: MarkdownStyle = {
  paragraph: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 27,
    marginBottom: 8,
  },
  h1: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 35,
    marginTop: 22,
    marginBottom: 10,
  },
  h2: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 31,
    marginTop: 20,
    marginBottom: 9,
  },
  h3: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 28,
    marginTop: 18,
    marginBottom: 8,
  },
  h4: {
    color: colors.textSecondary,
    fontSize: 19,
    lineHeight: 26,
    marginTop: 16,
    marginBottom: 7,
  },
  h5: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 25,
    marginTop: 14,
    marginBottom: 7,
  },
  h6: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 14,
    marginBottom: 7,
  },
  link: { color: "#c4b5fd", underline: true },
  blockquote: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 25,
    borderColor: accent,
    borderWidth: 3,
    gapWidth: 12,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  list: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 27,
    bulletColor: accent,
    markerColor: accent,
    gapWidth: 8,
    marginLeft: 8,
    marginBottom: 10,
  },
  table: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    headerBackgroundColor: colors.surfacePressed,
    headerTextColor: colors.text,
    rowEvenBackgroundColor: colors.surface,
    rowOddBackgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    cellPaddingHorizontal: 8,
    cellPaddingVertical: 7,
    marginBottom: 12,
  },
  code: {
    color: colors.textSecondary,
    backgroundColor: colors.surfacePressed,
    fontSize: 14,
  },
  codeBlock: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  math: {
    color: colors.text,
    fontSize: 20,
    backgroundColor: colors.surface,
    padding: 8,
    marginTop: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  inlineMath: { color: colors.text },
  image: { borderRadius: 7, marginTop: 8, marginBottom: 10 },
};

const TRANSLATION_STYLE: MarkdownStyle = {
  ...MARKDOWN_STYLE,
  paragraph: { ...MARKDOWN_STYLE.paragraph, color: translatedText },
  h1: { ...MARKDOWN_STYLE.h1, color: "#ede9fe" },
  h2: { ...MARKDOWN_STYLE.h2, color: "#ede9fe" },
  h3: { ...MARKDOWN_STYLE.h3, color: translatedText },
  h4: { ...MARKDOWN_STYLE.h4, color: translatedText },
  h5: { ...MARKDOWN_STYLE.h5, color: "#c4b5fd" },
  h6: { ...MARKDOWN_STYLE.h6, color: "#c4b5fd" },
  list: { ...MARKDOWN_STYLE.list, color: translatedText },
  table: { ...MARKDOWN_STYLE.table, color: translatedText },
};

const DUAL_TRANSLATION_STYLE: MarkdownStyle = {
  ...TRANSLATION_STYLE,
  // In dual mode the translated heading immediately follows the same source
  // heading. Preserve its typography without stacking two section top margins.
  h1: { ...TRANSLATION_STYLE.h1, marginTop: 0 },
  h2: { ...TRANSLATION_STYLE.h2, marginTop: 0 },
  h3: { ...TRANSLATION_STYLE.h3, marginTop: 0 },
  h4: { ...TRANSLATION_STYLE.h4, marginTop: 0 },
  h5: { ...TRANSLATION_STYLE.h5, marginTop: 0 },
  h6: { ...TRANSLATION_STYLE.h6, marginTop: 0 },
};

export function PaperViewer({
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
  const insets = useSafeAreaInsets();
  const nativeReaderAvailable = hasNativeMarkdownRenderer();
  const list = useRef<FlatList<PaperBlock>>(null);
  const blurTarget = useRef<View>(null);
  const loadController = useRef<AbortController | null>(null);
  const documentRef = useRef<PaperDocument | null>(null);
  const visibleIds = useRef<string[]>([]);
  const firstVisibleId = useRef<string | null>(null);
  const enqueueRef = useRef<(ids: string[]) => Promise<void>>(
    async () => undefined,
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 15 }).current;
  const [document, setDocument] = useState<PaperDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("source");
  const [tocOpen, setTocOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [visibleBlockId, setVisibleBlockId] = useState<string | null>(null);
  const readerPositionReady = useRef(false);
  const expectedInitialOffset = useRef(0);
  const renderStartIndexRef = useRef(0);
  const pendingNavigationIndex = useRef<number | null>(null);
  const [renderStartIndex, setRenderStartIndex] = useState(0);
  const [showPaperHeader, setShowPaperHeader] = useState(true);
  const [initialContentOffset, setInitialContentOffset] = useState<
    number | null
  >(null);
  const readerTopPadding = Math.max(insets.top, 8) + 64;

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
    document?.blocks.forEach((block, index) => {
      result.set(block.id, index);
      for (const anchor of block.anchorIds) result.set(anchor, index);
    });
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
    pendingNavigationIndex.current = null;
    firstVisibleId.current = null;
    setRenderStartIndex(0);
    setShowPaperHeader(true);
    setInitialContentOffset(null);
    setVisibleBlockId(null);
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
          setVisibleBlockId(initial.blockId);
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
  }, [nativeReaderAvailable, paper, readerTopPadding, sourceUri, t]);

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
    ({ viewableItems }: { viewableItems: ViewToken<PaperBlock>[] }) => {
      const currentDocument = documentRef.current;
      if (!currentDocument) return;
      const orderedItems = viewableItems
        .filter(
          (item): item is ViewToken<PaperBlock> & { index: number } =>
            item.index !== null,
        )
        .sort((a, b) => a.index - b.index);
      if (orderedItems.length === 0) return;
      const indexes = orderedItems
        .map((item) =>
          currentDocument.blocks.findIndex(
            (block) => block.id === item.item.id,
          ),
        )
        .filter((index) => index >= 0);
      if (indexes.length === 0) return;
      const first = Math.max(0, Math.min(...indexes) - 1);
      const visibleFirst = Math.min(...indexes);
      const last = Math.min(
        currentDocument.blocks.length - 1,
        Math.max(...indexes, 0) + 3,
      );
      const ids = currentDocument.blocks
        .slice(first, last + 1)
        .map((block) => block.id);
      visibleIds.current = ids;
      const blockId = currentDocument.blocks[visibleFirst]?.id ?? null;
      firstVisibleId.current = blockId;
      setVisibleBlockId(blockId);
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
    void saveReaderPosition(
      paper.arxivId,
      blockId,
    ).catch(() => {
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

  const scrollToDocumentIndex = useCallback(
    (index: number) => {
      const startIndex = renderStartIndexRef.current;
      if (index >= startIndex) {
        list.current?.scrollToIndex({
          index: index - startIndex,
          animated: true,
          viewPosition: 0.08,
        });
        return;
      }
      pendingNavigationIndex.current = index;
      revealWholeDocument();
    },
    [revealWholeDocument],
  );

  useEffect(() => {
    const index = pendingNavigationIndex.current;
    if (index === null || renderStartIndex !== 0 || !showPaperHeader) return;
    pendingNavigationIndex.current = null;
    const frame = requestAnimationFrame(() => {
      list.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.08,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [renderStartIndex, showPaperHeader]);

  const closeViewer = useCallback(() => {
    persistReaderPosition();
    setAskOpen(false);
    onClose();
  }, [onClose, persistReaderPosition]);

  const openAsk = useCallback(
    (selection?: AskSelection) => {
      // The toolbar entry intentionally asks about the current viewport. Only
      // the native selection action should retain an explicit quoted passage.
      ask.setSelection(selection ?? null);
      setAskOpen(true);
    },
    [ask],
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
      if (/^https?:/i.test(url)) {
        void Linking.openURL(url).catch(() => undefined);
      }
    },
    [anchorIndex, scrollToDocumentIndex],
  );

  const changeMode = useCallback(async () => {
    if (mode === "source") {
      if (!providerProfile) {
        Alert.alert(t("translation.setupTitle"), t("translation.setupBody"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.settings"), onPress: onOpenSettings },
        ]);
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
        Alert.alert(t("translation.setupTitle"), t("translation.setupBody"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.settings"), onPress: onOpenSettings },
        ]);
        return;
      }
      setMode("dual");
    } else if (mode === "dual") {
      setMode("translation");
    } else {
      setMode("source");
    }
  }, [getProviderApiKey, mode, onOpenSettings, providerProfile, t]);

  const askAvailable = askEnabled && Platform.OS === "android";
  const renderBlock = useCallback(
    ({ item }: ListRenderItemInfo<PaperBlock>) => (
      <ReaderBlock
        block={item}
        mode={mode}
        translation={translation.translations[item.id]}
        onLinkPress={openLink}
        askEnabled={askAvailable}
        arxivId={paper?.arxivId ?? ""}
        onAsk={openAsk}
      />
    ),
    [
      askAvailable,
      mode,
      openAsk,
      openLink,
      paper?.arxivId,
      translation.translations,
    ],
  );

  const modeLabel =
    mode === "source"
      ? t("common.translate")
      : mode === "dual"
        ? t("translation.translationOnly")
        : t("common.original");

  return (
    <Modal
      visible={paper != null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeViewer}
    >
      <View style={styles.root}>
        <StatusBar style="light" />
        <BlurTargetView ref={blurTarget} style={styles.root}>
          {nativeReaderAvailable && document && paper ? (
            <FlatList
              ref={list}
              data={renderedBlocks}
              keyExtractor={(block) => block.id}
              renderItem={renderBlock}
              contentOffset={
                initialContentOffset === null
                  ? undefined
                  : { x: 0, y: initialContentOffset }
              }
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              contentContainerStyle={{
                paddingTop: readerTopPadding,
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 16) + 40,
              }}
              ListHeaderComponent={
                showPaperHeader ? (
                  <PaperHeader
                    paper={paper}
                    mode={mode}
                    translation={
                      translation.translations[PAPER_TITLE_TRANSLATION_ID]
                    }
                  />
                ) : null
              }
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              updateCellsBatchingPeriod={40}
              windowSize={7}
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                list.current?.scrollToOffset({
                  offset: Math.max(0, index * averageItemLength),
                  animated: true,
                });
              }}
              onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                const offset = event.nativeEvent.contentOffset.y;
                if (
                  !readerPositionReady.current &&
                  Math.abs(offset - expectedInitialOffset.current) > 2
                ) {
                  return;
                }
                readerPositionReady.current = true;
              }}
              onScrollBeginDrag={(event) => {
                readerPositionReady.current = true;
                revealWholeDocument();
              }}
              onMomentumScrollEnd={persistReaderPosition}
              onScrollEndDrag={persistReaderPosition}
              scrollEventThrottle={100}
            />
          ) : null}

          {!nativeReaderAvailable ? (
            <MissingNativeReader onClose={closeViewer} />
          ) : null}

          {nativeReaderAvailable && loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={accent} size="large" />
              <Text style={styles.loadingText}>{t("reader.loading")}</Text>
            </View>
          ) : null}

          {nativeReaderAvailable && !loading && loadError && paper ? (
            <ReaderError
              message={loadError}
              onRetry={load}
              onOpenPdf={() =>
                void Linking.openURL(paper.pdfUrl).catch(() => undefined)
              }
              onOpenArxiv={() =>
                void Linking.openURL(
                  `https://arxiv.org/abs/${paper.arxivId}`,
                ).catch(() => undefined)
              }
            />
          ) : null}

          <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}>
            <Pressable
              accessibilityLabel={t("common.back")}
              onPress={closeViewer}
              hitSlop={10}
              style={styles.iconButton}
            >
              <ArrowLeft color={colors.text} size={21} strokeWidth={1.9} />
            </Pressable>
            <View style={styles.statusBox}>
              <Text style={styles.barTitle} numberOfLines={1}>
                {paper ? `arXiv:${paper.arxivId}` : "Paprism"}
              </Text>
              {mode !== "source" ? (
                <Text style={styles.statusText} numberOfLines={1}>
                  {translation.progress.completed}/{translation.total || "—"}
                  {translation.progress.pending
                    ? ` · ${t("translation.pending", { count: translation.progress.pending })}`
                    : ""}
                </Text>
              ) : (
                <Text style={styles.statusText} numberOfLines={1}>
                  {providerProfile?.name ?? t("provider.noModel")}
                </Text>
              )}
              {translation.error ? (
                <Pressable onPress={translation.retryFailed} hitSlop={8}>
                  <Text style={styles.errorText} numberOfLines={1}>
                    {translation.error} · {t("translation.retryFailed")}
                  </Text>
                </Pressable>
              ) : translation.progress.pending > 0 ? (
                <Pressable onPress={translation.cancel} hitSlop={8}>
                  <Text style={styles.cancelText}>{t("common.cancel")}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.actions}>
              {askAvailable && nativeReaderAvailable ? (
                <Pressable
                  accessibilityLabel="Ask"
                  onPress={() => openAsk()}
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <MessageCircleQuestion
                    color={accent}
                    size={20}
                    strokeWidth={1.8}
                  />
                </Pressable>
              ) : null}
              {headings.length > 0 ? (
                <Pressable
                  accessibilityLabel={t("reader.contents")}
                  onPress={() => setTocOpen(true)}
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <ListTree
                    color={colors.textSecondary}
                    size={20}
                    strokeWidth={1.8}
                  />
                </Pressable>
              ) : null}
              {nativeReaderAvailable ? (
                <Pressable
                  accessibilityLabel={modeLabel}
                  onPress={() => void changeMode()}
                  hitSlop={10}
                  style={styles.modeButton}
                >
                  <Languages color={accent} size={16} strokeWidth={1.9} />
                  <Text style={styles.chipText}>{modeLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <ContentsSheet
            visible={tocOpen}
            headings={headings}
            onClose={() => setTocOpen(false)}
            onSelect={(id) => {
              const index = anchorIndex.get(id);
              setTocOpen(false);
              if (index !== undefined) {
                scrollToDocumentIndex(index);
              }
            }}
          />
        </BlurTargetView>
        <AskSheet
          visible={askOpen}
          conversation={ask}
          chatProfile={askProviderProfile}
          visibleBlockId={visibleBlockId}
          onClose={() => setAskOpen(false)}
          onOpenSettings={() => {
            setAskOpen(false);
            onOpenAskSettings();
          }}
          blurTarget={blurTarget}
        />
      </View>
    </Modal>
  );
}

function PaperHeader({
  paper,
  mode,
  translation,
}: {
  paper: Paper;
  mode: Mode;
  translation?: string;
}) {
  return (
    <View style={styles.paperHeader}>
      <Text style={styles.paperId}>arXiv:{paper.arxivId}</Text>
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
    </View>
  );
}

function ReaderBlock({
  block,
  mode,
  translation,
  onLinkPress,
  askEnabled,
  arxivId,
  onAsk,
}: {
  block: PaperBlock;
  mode: Mode;
  translation?: string;
  onLinkPress: (event: { url: string }) => void;
  askEnabled: boolean;
  arxivId: string;
  onAsk: (selection: AskSelection) => void;
}) {
  const showSource =
    mode !== "translation" || !block.translationSource || !translation;
  const showTranslation = mode !== "source" && !!translation;
  return (
    <View style={styles.block}>
      {block.assets?.map((asset, index) => (
        <PaperImage key={`${asset.uri}-${index}`} asset={asset} />
      ))}
      {showSource && block.markdown ? (
        <PaperMarkdown
          markdown={block.markdown}
          onLinkPress={onLinkPress}
          askEnabled={askEnabled}
          onAsk={(text) =>
            onAsk({
              arxivId,
              blockId: block.id,
              text,
              sourceText: block.plainText,
              sectionTitle: block.sectionTitle,
              language: "source",
            })
          }
        />
      ) : null}
      {showTranslation ? (
        <View
          style={mode === "dual" ? styles.translation : styles.translationOnly}
        >
          <PaperMarkdown
            markdown={translation}
            onLinkPress={onLinkPress}
            translated
            compactHeading={mode === "dual"}
            askEnabled={askEnabled}
            onAsk={(text) =>
              onAsk({
                arxivId,
                blockId: block.id,
                text,
                sourceText: block.plainText,
                sectionTitle: block.sectionTitle,
                language: "translation",
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function PaperMarkdown({
  markdown,
  translated = false,
  compactHeading = false,
  onLinkPress,
  askEnabled = false,
  onAsk,
}: {
  markdown: string;
  translated?: boolean;
  compactHeading?: boolean;
  onLinkPress: (event: { url: string }) => void;
  askEnabled?: boolean;
  onAsk?: (text: string) => void;
}) {
  return (
    <EnrichedMarkdownText
      markdown={markdown}
      markdownStyle={
        translated
          ? compactHeading
            ? DUAL_TRANSLATION_STYLE
            : TRANSLATION_STYLE
          : MARKDOWN_STYLE
      }
      onLinkPress={onLinkPress}
      selectable
      flavor="github"
      md4cFlags={{ latexMath: true, superscript: true, subscript: true }}
      textBreakStrategy="highQuality"
      maxFontSizeMultiplier={1.8}
      selectionColor="rgba(139,92,246,0.28)"
      selectionHandleColor="#7c3aed"
      contextMenuItems={
        askEnabled && onAsk
          ? [
              {
                text: "Ask",
                icon: "auto_awesome",
                onPress: ({ text }) => onAsk(text),
              },
            ]
          : undefined
      }
    />
  );
}

function PaperImage({ asset }: { asset: PaperAsset }) {
  const aspectRatio = asset.aspectRatio ?? 4 / 3;
  if (/\.svg(?:$|[?#])/i.test(asset.uri)) {
    return (
      <View
        accessibilityLabel={asset.alt}
        style={[styles.figure, { aspectRatio }]}
      >
        <SvgUri
          uri={asset.uri}
          width="100%"
          height="100%"
          onError={ignoreImageError}
          fallback={<Text style={styles.figureFallback}>{asset.alt}</Text>}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: asset.uri }}
      accessibilityLabel={asset.alt}
      resizeMode="contain"
      style={[styles.figure, { aspectRatio }]}
    />
  );
}

function MissingNativeReader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>{t("reader.devClientTitle")}</Text>
      <Text style={styles.errorBody}>{t("reader.devClientBody")}</Text>
      <View style={styles.errorActions}>
        <Pressable style={styles.primaryButton} onPress={onClose}>
          <Text style={styles.primaryButtonText}>{t("common.close")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReaderError({
  message,
  onRetry,
  onOpenPdf,
  onOpenArxiv,
}: {
  message: string;
  onRetry: () => void;
  onOpenPdf: () => void;
  onOpenArxiv: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>{t("reader.unavailable")}</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <View style={styles.errorActions}>
        <Pressable style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>{t("common.retry")}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onOpenPdf}>
          <Text style={styles.secondaryButtonText}>{t("reader.openPdf")}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onOpenArxiv}>
          <Text style={styles.secondaryButtonText}>
            {t("reader.openArxiv")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ContentsSheet({
  visible,
  headings,
  onClose,
  onSelect,
}: {
  visible: boolean;
  headings: PaperBlock[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t("reader.contents")}</Text>
            <Pressable
              accessibilityLabel={t("common.close")}
              hitSlop={10}
              onPress={onClose}
              style={styles.sheetClose}
            >
              <X color={colors.muted} size={20} strokeWidth={1.8} />
            </Pressable>
          </View>
          <FlatList
            data={headings}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={styles.tocRow}
                onPress={() => onSelect(item.id)}
              >
                <Text style={styles.tocText}>{item.plainText}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: "rgba(9,9,11,0.96)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actions: { flexDirection: "row", gap: 5 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modeButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  statusBox: {
    flex: 1,
    paddingHorizontal: 6,
    minWidth: 0,
  },
  barTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  statusText: { color: colors.dim, fontSize: 10, marginTop: 2 },
  errorText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.muted, fontSize: 14, marginTop: 12 },
  paperHeader: {
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    marginBottom: 12,
  },
  paperId: {
    color: accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  paperTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
  },
  translatedPaperTitle: {
    color: translatedText,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "700",
    marginTop: 10,
  },
  authors: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  block: { marginBottom: 6 },
  translation: {
    borderLeftWidth: 3,
    borderLeftColor: accentStrong,
    paddingLeft: 12,
    marginTop: 5,
    marginBottom: 8,
  },
  translationOnly: { marginBottom: 8 },
  figure: {
    width: "100%",
    // arXiv figures often use transparent backgrounds with black labels.
    // Keep a paper-colored canvas so their original pixels stay readable.
    backgroundColor: "#f4f4f5",
    borderRadius: radii.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginVertical: 8,
  },
  figureFallback: { color: colors.muted, fontSize: 13, padding: 12 },
  errorTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  errorBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  errorActions: { marginTop: 20, gap: 8, width: "100%", maxWidth: 300 },
  primaryButton: {
    minHeight: 46,
    backgroundColor: colors.text,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.inverse, fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    minHeight: 46,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    maxHeight: "76%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginBottom: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfacePressed,
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  sheetClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
  },
  tocRow: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tocText: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },
});
