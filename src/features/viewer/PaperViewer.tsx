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
} from "react-native";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Languages from "lucide-react-native/icons/languages";
import ListTree from "lucide-react-native/icons/list-tree";
import X from "lucide-react-native/icons/x";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import { SvgUri } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderProfile } from "@/features/settings/providerCore";
import { resolveTranslateLang, type TranslateLangPref } from "@/lib/storage";
import { colors, radii } from "@/shared/theme";
import type { Paper } from "@/types/paper";
import { loadPaperDocument } from "./paperSource";
import type { PaperAsset, PaperBlock, PaperDocument } from "./paperDocument";
import {
  PAPER_TITLE_TRANSLATION_ID,
  useDocumentTranslation,
} from "./useDocumentTranslation";

type Props = {
  paper: Paper | null;
  translateLangPref: TranslateLangPref;
  sourceUri?: string;
  providerProfile: ProviderProfile | null;
  getProviderApiKey: (profileId: string) => Promise<string | null>;
  onOpenSettings: () => void;
  onClose: () => void;
};

type Mode = "source" | "dual" | "translation";
const ignoreImageError = () => undefined;
const accent = "#a78bfa";
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

export function PaperViewer({
  paper,
  translateLangPref,
  sourceUri,
  providerProfile,
  getProviderApiKey,
  onOpenSettings,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const nativeReaderAvailable = hasNativeMarkdownRenderer();
  const list = useRef<FlatList<PaperBlock>>(null);
  const loadController = useRef<AbortController | null>(null);
  const documentRef = useRef<PaperDocument | null>(null);
  const visibleIds = useRef<string[]>([]);
  const enqueueRef = useRef<(ids: string[]) => Promise<void>>(
    async () => undefined,
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 15 }).current;
  const [document, setDocument] = useState<PaperDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("source");
  const [tocOpen, setTocOpen] = useState(false);

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

  const load = useCallback(() => {
    // Retry, close, and paper changes all share one owner. A late response from
    // an older paper must never replace the currently requested document.
    loadController.current?.abort();
    loadController.current = null;
    if (!paper || !nativeReaderAvailable) return;
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setLoadError(null);
    setMode("source");
    setDocument(null);
    void loadPaperDocument(paper, sourceUri, controller.signal)
      .then((nextDocument) => {
        if (
          loadController.current === controller &&
          !controller.signal.aborted
        ) {
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
  }, [nativeReaderAvailable, paper, sourceUri, t]);

  useEffect(load, [load]);

  useEffect(() => {
    if (mode === "source" || !document) return;
    const ids =
      visibleIds.current.length > 0
        ? visibleIds.current
        : document.blocks.slice(0, 8).map((block) => block.id);
    void translation.enqueue([PAPER_TITLE_TRANSLATION_ID, ...ids]);
  }, [document, mode, translation.enqueue]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<PaperBlock>[] }) => {
      const currentDocument = documentRef.current;
      if (!currentDocument) return;
      const indexes = viewableItems
        .map((item) => item.index)
        .filter((index): index is number => index !== null);
      if (indexes.length === 0) return;
      const first = Math.max(0, Math.min(...indexes) - 1);
      const last = Math.min(
        currentDocument.blocks.length - 1,
        Math.max(...indexes, 0) + 3,
      );
      const ids = currentDocument.blocks
        .slice(first, last + 1)
        .map((block) => block.id);
      visibleIds.current = ids;
      void enqueueRef.current(ids);
    },
  ).current;

  const openLink = useCallback(
    ({ url }: { url: string }) => {
      const prefix = "paprism://anchor/";
      if (url.startsWith(prefix)) {
        const anchor = decodeURIComponent(url.slice(prefix.length));
        const index = anchorIndex.get(anchor);
        if (index !== undefined) {
          list.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.08,
          });
        }
        return;
      }
      if (/^https?:/i.test(url)) {
        void Linking.openURL(url).catch(() => undefined);
      }
    },
    [anchorIndex],
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

  const renderBlock = useCallback(
    ({ item }: ListRenderItemInfo<PaperBlock>) => (
      <ReaderBlock
        block={item}
        mode={mode}
        translation={translation.translations[item.id]}
        onLinkPress={openLink}
      />
    ),
    [mode, openLink, translation.translations],
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
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <StatusBar style="light" />
        {nativeReaderAvailable && document && paper ? (
          <FlatList
            ref={list}
            data={document.blocks}
            keyExtractor={(block) => block.id}
            renderItem={renderBlock}
            contentContainerStyle={{
              paddingTop: Math.max(insets.top, 8) + 64,
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 16) + 40,
            }}
            ListHeaderComponent={
              <PaperHeader
                paper={paper}
                mode={mode}
                translation={
                  translation.translations[PAPER_TITLE_TRANSLATION_ID]
                }
              />
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
          />
        ) : null}

        {!nativeReaderAvailable ? (
          <MissingNativeReader onClose={onClose} />
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
            onPress={onClose}
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
              list.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.08,
              });
            }
          }}
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
}: {
  block: PaperBlock;
  mode: Mode;
  translation?: string;
  onLinkPress: (event: { url: string }) => void;
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
        <PaperMarkdown markdown={block.markdown} onLinkPress={onLinkPress} />
      ) : null}
      {showTranslation ? (
        <View
          style={mode === "dual" ? styles.translation : styles.translationOnly}
        >
          <PaperMarkdown
            markdown={translation}
            onLinkPress={onLinkPress}
            translated
          />
        </View>
      ) : null}
    </View>
  );
}

function PaperMarkdown({
  markdown,
  translated = false,
  onLinkPress,
}: {
  markdown: string;
  translated?: boolean;
  onLinkPress: (event: { url: string }) => void;
}) {
  return (
    <EnrichedMarkdownText
      markdown={markdown}
      markdownStyle={translated ? TRANSLATION_STYLE : MARKDOWN_STYLE}
      onLinkPress={onLinkPress}
      selectable
      flavor="github"
      md4cFlags={{ latexMath: true, superscript: true, subscript: true }}
      textBreakStrategy="highQuality"
      maxFontSizeMultiplier={1.8}
      selectionColor="rgba(139,92,246,0.28)"
      selectionHandleColor="#7c3aed"
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
