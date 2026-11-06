import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Globe2 from "lucide-react-native/icons/earth";
import MessageCircleQuestion from "lucide-react-native/icons/message-circle-question-mark";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import Settings2 from "lucide-react-native/icons/settings-2";
import Square from "lucide-react-native/icons/square";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderProfile } from "@/features/settings/providerCore";
import { colors, radii, surfaces, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { PressableScale } from "@/shared/ui/PressableScale";
import { useSheetPresence } from "@/shared/ui/useSheetPresence";
import type { useAskConversation } from "./useAskConversation";
import type { AskMessage, AskSource } from "./askTypes";
import { useAppDialog } from "@/shared/AppDialog";

type Conversation = ReturnType<typeof useAskConversation>;
const NO_SOURCES: AskSource[] = [];
// Within this distance of the end, new text keeps the view pinned to the bottom.
const PINNED_THRESHOLD = 56;

const ASK_MARKDOWN_STYLE: MarkdownStyle = {
  paragraph: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 8,
  },
  h1: { color: colors.text, fontSize: 18, lineHeight: 24, marginBottom: 8 },
  h2: { color: colors.text, fontSize: 17, lineHeight: 23, marginBottom: 8 },
  h3: { color: colors.text, fontSize: 16, lineHeight: 22, marginBottom: 7 },
  h4: { color: colors.text, fontSize: 15, lineHeight: 21, marginBottom: 7 },
  strong: { color: colors.text },
  em: { color: colors.textSecondary },
  link: { color: colors.accent, underline: true },
  list: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    bulletColor: colors.muted,
    markerColor: colors.muted,
    gapWidth: 6,
    marginLeft: 4,
    marginBottom: 8,
  },
  blockquote: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    borderColor: colors.accent,
    borderWidth: 2,
    gapWidth: 10,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  code: {
    color: colors.textSecondary,
    backgroundColor: colors.surfacePressed,
    fontSize: 13,
  },
  codeBlock: {
    color: colors.textSecondary,
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.small,
    padding: 11,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  math: {
    color: colors.text,
    backgroundColor: "transparent",
  },
  inlineMath: { color: colors.text },
};

/**
 * Model output and web citations are untrusted. Only web links may leave the
 * app, so an answer cannot trigger intent:// or similar schemes.
 */
function openWebLink(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  void Linking.openURL(url).catch(() => undefined);
}

const openMarkdownLink = ({ url }: { url: string }) => openWebLink(url);

export function AskSheet({
  visible,
  conversation,
  chatProfile,
  getVisibleBlockId,
  onClose,
  onNavigateToSource,
  onOpenSettings,
  blurTarget,
}: {
  visible: boolean;
  conversation: Conversation;
  chatProfile: ProviderProfile | null;
  getVisibleBlockId: () => string | null;
  onClose: () => void;
  onNavigateToSource: (blockId: string) => void;
  onOpenSettings: () => void;
  blurTarget: RefObject<View | null>;
}) {
  const { t } = useTranslation();
  const { showDialog, showError } = useAppDialog();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { mounted, progress } = useSheetPresence(visible);
  const scroll = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);
  const pinnedToEnd = useRef(true);
  const persistUiRef = useRef(conversation.persistUi);
  persistUiRef.current = conversation.persistUi;
  const [webSearch, setWebSearch] = useState(false);
  const supportsSearch = chatProfile?.kind === "openrouter";
  const useWebSearch = webSearch && supportsSearch;

  useEffect(() => {
    if (visible) restoredScroll.current = false;
    else void persistUiRef.current().catch(() => undefined);
    return () => {
      if (visible) void persistUiRef.current().catch(() => undefined);
    };
  }, [visible]);

  const sourcesByMessage = useMemo(() => {
    const grouped = new Map<string, AskSource[]>();
    for (const source of conversation.sources) {
      const list = grouped.get(source.messageId) ?? [];
      list.push(source);
      grouped.set(source.messageId, list);
    }
    return grouped;
  }, [conversation.sources]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * windowHeight * 0.6 }],
    opacity: progress.value,
  }));

  const { retry, send, setDraft, stop, setSelection } = conversation;

  const submitQuestion = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      pinnedToEnd.current = true;
      void send(trimmed, getVisibleBlockId(), useWebSearch).catch((error) =>
        showError(t("common.operationFailed"), error),
      );
    },
    [getVisibleBlockId, send, showError, t, useWebSearch],
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      pinnedToEnd.current = true;
      void retry(messageId, getVisibleBlockId(), useWebSearch).catch((error) =>
        showError(t("common.operationFailed"), error),
      );
    },
    [getVisibleBlockId, retry, showError, t, useWebSearch],
  );

  const openSource = useCallback(
    (source: AskSource) => {
      if (source.url) openWebLink(source.url);
      else if (source.blockId) onNavigateToSource(source.blockId);
    },
    [onNavigateToSource],
  );

  const confirmClear = () =>
    showDialog({
      kind: "destructive",
      title: t("ask.clearPaperTitle"),
      message: t("ask.clearPaperBody"),
      actions: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("library.clear"),
          style: "destructive",
          onPress: async () => {
            try {
              await conversation.clear();
              showDialog({
                kind: "success",
                title: t("ask.clearPaperSuccess"),
              });
            } catch (error) {
              showError(t("common.operationFailed"), error);
            }
          },
        },
      ],
    });

  if (!mounted) return null;

  const canSend = !conversation.busy && conversation.draft.trim().length > 0;

  return (
    <View pointerEvents={visible ? "auto" : "none"} style={styles.overlay}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.positioner}
        pointerEvents="box-none"
      >
        {/* Animate this wrapper, not the BlurView. An animated BlurView only
            updates its inner native view, so the outer view would keep the
            first frame's opacity of 0 and hide the sheet. */}
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 12) + 6 },
            sheetStyle,
          ]}
        >
          <BlurView
            intensity={52}
            tint="dark"
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={3}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.sheetTint} />
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                Paprism Ask
              </Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                {chatProfile?.name ?? t("ask.providerMissing")}
              </Text>
            </View>
            {conversation.messages.length > 0 ? (
              <IconButton
                icon={Trash2}
                iconSize={17}
                color={colors.muted}
                label={t("ask.clearPaperTitle")}
                onPress={confirmClear}
                size={38}
              />
            ) : null}
            <IconButton
              icon={X}
              iconSize={18}
              color={colors.textSecondary}
              label={t("common.close")}
              onPress={onClose}
              size={38}
            />
          </View>

          {conversation.selection ? (
            <View style={styles.quote}>
              <View style={styles.quoteCopy}>
                <Text style={styles.quoteLabel}>{t("ask.selectedText")}</Text>
                <Text style={styles.quoteText} numberOfLines={3}>
                  {conversation.selection.text}
                </Text>
              </View>
              <IconButton
                plain
                icon={X}
                iconSize={15}
                color={colors.muted}
                label={t("ask.removeQuote")}
                onPress={() => setSelection(null)}
                size={32}
              />
            </View>
          ) : null}

          {!chatProfile ? (
            <EmptyState
              icon={MessageCircleQuestion}
              title={t("ask.setupTitle")}
              body={t("ask.setupBody")}
              style={styles.setup}
            >
              <Button
                variant="primary"
                icon={Settings2}
                label={t("common.settings")}
                onPress={onOpenSettings}
              />
            </EmptyState>
          ) : (
            <>
              <ScrollView
                ref={scroll}
                style={styles.messages}
                contentContainerStyle={styles.messageContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onContentSizeChange={() => {
                  if (!restoredScroll.current) {
                    restoredScroll.current = true;
                    scroll.current?.scrollTo({
                      y: conversation.chatOffset,
                      animated: false,
                    });
                  } else if (conversation.busy && pinnedToEnd.current) {
                    // Follow the answer, unless the user scrolled up to read.
                    scroll.current?.scrollToEnd({ animated: false });
                  }
                }}
                onScroll={(event) => {
                  const { contentOffset, contentSize, layoutMeasurement } =
                    event.nativeEvent;
                  pinnedToEnd.current =
                    contentSize.height -
                      layoutMeasurement.height -
                      contentOffset.y <
                    PINNED_THRESHOLD;
                  conversation.setChatOffset(contentOffset.y);
                }}
                scrollEventThrottle={100}
              >
                {conversation.messages.length === 0 ? (
                  <View style={styles.intro}>
                    <EmptyState
                      icon={MessageCircleQuestion}
                      body={t("ask.empty")}
                    />
                    <View style={styles.suggestions}>
                      {(
                        [
                          "ask.suggestSummary",
                          "ask.suggestMethod",
                          "ask.suggestLimits",
                        ] as const
                      ).map((key) => (
                        <PressableScale
                          key={key}
                          onPress={() => submitQuestion(t(key))}
                          scaleTo={0.97}
                          style={styles.suggestion}
                        >
                          <Text style={styles.suggestionText}>{t(key)}</Text>
                        </PressableScale>
                      ))}
                    </View>
                  </View>
                ) : null}
                {conversation.messages.map((message) => (
                  <AskMessageRow
                    key={message.id}
                    message={message}
                    sources={sourcesByMessage.get(message.id) ?? NO_SOURCES}
                    activity={
                      message.status === "pending"
                        ? conversation.activity
                        : null
                    }
                    semanticUsed={conversation.semanticUsed}
                    onRetry={retryMessage}
                    onOpenSource={openSource}
                  />
                ))}
              </ScrollView>
              <View style={styles.composer}>
                {supportsSearch ? (
                  <IconButton
                    plain
                    icon={Globe2}
                    iconSize={18}
                    active={webSearch}
                    color={colors.muted}
                    label={t("ask.webSearch")}
                    onPress={() => setWebSearch((value) => !value)}
                    size={38}
                    style={styles.toolButton}
                  />
                ) : null}
                <TextInput
                  value={conversation.draft}
                  onChangeText={setDraft}
                  placeholder={t("ask.placeholder")}
                  placeholderTextColor={colors.dim}
                  selectionColor={colors.accent}
                  multiline
                  style={styles.input}
                />
                {conversation.busy ? (
                  <PressableScale
                    accessibilityLabel={t("ask.stop")}
                    onPress={stop}
                    scaleTo={0.9}
                    style={[styles.send, styles.stop]}
                  >
                    <Square
                      color={colors.text}
                      fill={colors.text}
                      size={12}
                      strokeWidth={0}
                    />
                  </PressableScale>
                ) : (
                  <PressableScale
                    accessibilityLabel={t("ask.send")}
                    accessibilityState={{ disabled: !canSend }}
                    disabled={!canSend}
                    onPress={() => submitQuestion(conversation.draft)}
                    scaleTo={0.9}
                    style={[styles.send, !canSend && styles.sendDisabled]}
                  >
                    <ArrowUp
                      color={colors.inverse}
                      size={18}
                      strokeWidth={2.2}
                    />
                  </PressableScale>
                )}
              </View>
              {useWebSearch ? (
                <View style={styles.searchWarning}>
                  <CircleAlert color={colors.muted} size={12} />
                  <Text style={styles.searchWarningText}>
                    {t("ask.webSearchCost")}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const AskMessageRow = memo(function AskMessageRow({
  message,
  sources,
  activity,
  semanticUsed,
  onRetry,
  onOpenSource,
}: {
  message: AskMessage;
  sources: AskSource[];
  activity: string | null;
  semanticUsed: boolean;
  onRetry: (messageId: string) => void;
  onOpenSource: (source: AskSource) => void;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const failed = message.status === "error";
  const canRetry = !isUser && (failed || message.status === "interrupted");
  // Retrieval can cite one section several times. Show each destination once.
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = `${source.title}\n${source.url ?? source.blockId ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [sources]);

  return (
    <View style={isUser ? styles.userMessage : styles.assistantMessage}>
      {isUser ? (
        <Text selectable style={styles.userText}>
          {message.content}
        </Text>
      ) : message.content && !failed ? (
        <EnrichedMarkdownText
          markdown={message.content}
          markdownStyle={ASK_MARKDOWN_STYLE}
          selectable
          flavor="commonmark"
          streamingAnimation={message.status === "streaming"}
          onLinkPress={openMarkdownLink}
          maxFontSizeMultiplier={1.8}
          selectionColor={colors.accentSelection}
          selectionHandleColor={colors.accent}
        />
      ) : message.status === "pending" ? (
        <View style={styles.workingStatus}>
          <ActivityIndicator color={colors.accent} size="small" />
          <View style={styles.workingCopy}>
            <Text style={styles.workingText}>
              {activity ? t(`ask.activity.${activity}`) : "…"}
            </Text>
            {activity && !semanticUsed ? (
              <Text style={styles.workingDetail}>{t("ask.noSemantic")}</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <Text selectable style={failed ? styles.errorText : styles.noteText}>
          {message.content || t("ask.interrupted")}
        </Text>
      )}
      {canRetry ? (
        <PressableScale
          onPress={() => onRetry(message.id)}
          scaleTo={0.96}
          style={styles.retry}
        >
          <RotateCcw color={colors.textSecondary} size={13} strokeWidth={1.8} />
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </PressableScale>
      ) : null}
      {uniqueSources.length > 0 ? (
        <View style={styles.sources}>
          {uniqueSources.map((source) => (
            <PressableScale
              accessibilityRole={source.url ? "link" : "button"}
              disabled={!source.url && !source.blockId}
              key={source.id}
              onPress={() => onOpenSource(source)}
              scaleTo={0.96}
              style={styles.source}
            >
              <Text style={styles.sourceText} numberOfLines={1}>
                {source.title}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  positioner: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    ...surfaces.sheet,
    height: "86%",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  sheetTint: {
    ...StyleSheet.absoluteFill,
    // The dark blur tint lifts everything toward gray. Keep the sheet below its
    // cards in brightness so the surface hierarchy still reads correctly.
    backgroundColor: "rgba(8,9,10,0.93)",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginTop: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfacePressed,
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  headerCopy: { flex: 1 },
  title: { ...typography.title, fontSize: 17, color: colors.text },
  subtitle: { ...typography.caption, color: colors.dim },
  quote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 6,
    paddingLeft: 12,
    paddingVertical: 9,
    paddingRight: 4,
    borderRadius: radii.medium,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  quoteCopy: { flex: 1 },
  quoteLabel: { ...typography.micro, color: colors.accent },
  quoteText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  messages: { flex: 1 },
  messageContent: { padding: 16, gap: 14 },
  intro: { gap: 8 },
  suggestions: { gap: 8, marginHorizontal: 8 },
  suggestion: {
    ...surfaces.control,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  suggestionText: { ...typography.body, color: colors.textSecondary },
  userMessage: {
    alignSelf: "flex-end",
    maxWidth: "86%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.large,
    borderBottomRightRadius: 6,
    backgroundColor: colors.surfacePressed,
  },
  userText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  assistantMessage: { alignSelf: "stretch" },
  noteText: { ...typography.body, color: colors.muted },
  errorText: { ...typography.body, color: colors.danger },
  sources: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  source: {
    maxWidth: "100%",
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sourceText: { ...typography.micro, color: colors.textSecondary },
  retry: {
    alignSelf: "flex-start",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  retryText: { ...typography.caption, color: colors.textSecondary },
  workingStatus: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // The message sizes itself from its contents. `flex: 1` gives this child no
  // intrinsic width on Android, so the activity label collapses and only the
  // spinner remains visible.
  workingCopy: { flexShrink: 1 },
  workingText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  workingDetail: { ...typography.micro, color: colors.dim, marginTop: 2 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginHorizontal: 12,
    marginTop: 4,
    padding: 5,
    borderRadius: 24,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.highlight,
  },
  toolButton: { borderRadius: radii.pill },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 38,
    maxHeight: 116,
    color: colors.text,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 9,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
  },
  sendDisabled: { opacity: 0.3 },
  stop: {
    backgroundColor: colors.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  searchWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginHorizontal: 16,
    marginTop: 6,
  },
  searchWarningText: {
    ...typography.micro,
    flexShrink: 1,
    color: colors.muted,
    textAlign: "center",
  },
  setup: { flex: 1, paddingBottom: 64 },
});
