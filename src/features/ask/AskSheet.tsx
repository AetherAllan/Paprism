import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Globe2 from "lucide-react-native/icons/earth";
import Send from "lucide-react-native/icons/send";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProviderProfile } from "@/features/settings/providerCore";
import { colors, radii } from "@/shared/theme";
import type { useAskConversation } from "./useAskConversation";
import { useAppDialog } from "@/shared/AppDialog";

type Conversation = ReturnType<typeof useAskConversation>;
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const ASK_MARKDOWN_STYLE: MarkdownStyle = {
  paragraph: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
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
    fontSize: 14,
    lineHeight: 21,
    bulletColor: colors.accent,
    markerColor: colors.accent,
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
    gapWidth: 9,
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
    borderRadius: 8,
    padding: 10,
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

export function AskSheet({
  visible,
  conversation,
  chatProfile,
  visibleBlockId,
  onClose,
  onOpenSettings,
  blurTarget,
}: {
  visible: boolean;
  conversation: Conversation;
  chatProfile: ProviderProfile | null;
  visibleBlockId: string | null;
  onClose: () => void;
  onOpenSettings: () => void;
  blurTarget: RefObject<View | null>;
}) {
  const { t } = useTranslation();
  const { showDialog, showError } = useAppDialog();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);
  const persistUiRef = useRef(conversation.persistUi);
  persistUiRef.current = conversation.persistUi;
  const [webSearch, setWebSearch] = useState(false);
  const supportsSearch = chatProfile?.kind === "openrouter";

  useEffect(() => {
    if (visible) restoredScroll.current = false;
    else void persistUiRef.current();
    return () => {
      if (visible) void persistUiRef.current();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose, visible]);

  const submit = () => {
    const question = conversation.draft.trim();
    if (!question) return;
    void conversation
      .send(question, visibleBlockId, webSearch)
      .catch((error) => showError(t("common.operationFailed"), error));
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.positioner}
        pointerEvents="box-none"
      >
        <AnimatedBlurView
          entering={reduceMotion ? undefined : FadeInDown.duration(260)}
          intensity={52}
          tint="dark"
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={3}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View pointerEvents="none" style={styles.sheetTint} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Paprism Ask</Text>
              <Text style={styles.subtitle}>
                {chatProfile?.name ?? t("ask.providerMissing")}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                hitSlop={8}
                onPress={() =>
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
                  })
                }
              >
                <Trash2 color={colors.dim} size={18} />
              </Pressable>
              <Pressable hitSlop={8} onPress={onClose}>
                <X color={colors.textSecondary} size={21} />
              </Pressable>
            </View>
          </View>

          {conversation.selection ? (
            <View style={styles.quote}>
              <Text style={styles.quoteLabel}>{t("ask.selectedText")}</Text>
              <Text style={styles.quoteText} numberOfLines={4}>
                {conversation.selection.text}
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() => conversation.setSelection(null)}
              >
                <Text style={styles.removeQuote}>{t("common.close")}</Text>
              </Pressable>
            </View>
          ) : null}

          {!chatProfile ? (
            <View style={styles.setup}>
              <Text style={styles.setupTitle}>{t("ask.setupTitle")}</Text>
              <Text style={styles.setupBody}>{t("ask.setupBody")}</Text>
              <Pressable style={styles.setupButton} onPress={onOpenSettings}>
                <Text style={styles.setupButtonText}>
                  {t("common.settings")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scroll}
                style={styles.messages}
                contentContainerStyle={styles.messageContent}
                onContentSizeChange={() => {
                  if (!restoredScroll.current) {
                    restoredScroll.current = true;
                    scroll.current?.scrollTo({
                      y: conversation.chatOffset,
                      animated: false,
                    });
                  } else if (conversation.busy) {
                    scroll.current?.scrollToEnd({ animated: true });
                  }
                }}
                onScroll={(event) =>
                  conversation.setChatOffset(event.nativeEvent.contentOffset.y)
                }
                scrollEventThrottle={100}
              >
                {conversation.messages.length === 0 ? (
                  <Text style={styles.empty}>{t("ask.empty")}</Text>
                ) : null}
                {conversation.messages.map((message) => {
                  const messageSources = conversation.sources.filter(
                    (source) => source.messageId === message.id,
                  );
                  return (
                    <View
                      key={message.id}
                      style={
                        message.role === "user"
                          ? styles.userMessage
                          : styles.assistantMessage
                      }
                    >
                      {message.role === "assistant" && message.content ? (
                        <EnrichedMarkdownText
                          markdown={message.content}
                          markdownStyle={ASK_MARKDOWN_STYLE}
                          selectable
                          flavor="commonmark"
                          streamingAnimation={message.status === "streaming"}
                          onLinkPress={({ url }) =>
                            void Linking.openURL(url).catch(() => undefined)
                          }
                          maxFontSizeMultiplier={1.8}
                          selectionColor="rgba(139,92,246,0.28)"
                          selectionHandleColor="#7c3aed"
                        />
                      ) : message.role === "assistant" &&
                        message.status === "pending" &&
                        conversation.activity ? (
                        <View style={styles.workingStatus}>
                          <ActivityIndicator
                            color={colors.accent}
                            size="small"
                          />
                          <View style={styles.workingCopy}>
                            <Text style={styles.workingText}>
                              {t(`ask.activity.${conversation.activity}`)}
                            </Text>
                            {!conversation.semanticUsed ? (
                              <Text style={styles.workingDetail}>
                                {t("ask.noSemantic")}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.messageText} selectable>
                          {message.content ||
                            (message.status === "pending"
                              ? "…"
                              : t("ask.interrupted"))}
                        </Text>
                      )}
                      {message.role === "assistant" &&
                      (message.status === "error" ||
                        message.status === "interrupted") ? (
                        <Pressable
                          onPress={() =>
                            void conversation
                              .retry(message.id, visibleBlockId, webSearch)
                              .catch((error) =>
                                showError(t("common.operationFailed"), error),
                              )
                          }
                        >
                          <Text style={styles.retryText}>
                            {t("common.retry")}
                          </Text>
                        </Pressable>
                      ) : null}
                      {messageSources.length > 0 ? (
                        <View style={styles.sources}>
                          {messageSources.map((source) => (
                            <Pressable
                              key={source.id}
                              disabled={!source.url}
                              onPress={() =>
                                source.url && void Linking.openURL(source.url)
                              }
                            >
                              <Text style={styles.sourceText} numberOfLines={1}>
                                {source.kind === "web" ? "↗" : "§"}{" "}
                                {source.title}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.composer}>
                <Pressable
                  accessibilityLabel={t("ask.webSearch")}
                  disabled={!supportsSearch}
                  onPress={() => setWebSearch((value) => !value)}
                  style={[
                    styles.toolButton,
                    webSearch && styles.toolButtonActive,
                  ]}
                >
                  <Globe2
                    color={
                      supportsSearch
                        ? webSearch
                          ? colors.accent
                          : colors.muted
                        : colors.dim
                    }
                    size={19}
                  />
                </Pressable>
                <TextInput
                  value={conversation.draft}
                  onChangeText={conversation.setDraft}
                  placeholder={t("ask.placeholder")}
                  placeholderTextColor={colors.dim}
                  multiline
                  style={styles.input}
                />
                <Pressable
                  disabled={conversation.busy || !conversation.draft.trim()}
                  onPress={submit}
                  style={styles.send}
                >
                  <Send color={colors.background} size={18} />
                </Pressable>
              </View>
              {supportsSearch ? (
                <View style={styles.searchWarning}>
                  <CircleAlert color={colors.text} size={13} />
                  <Text style={styles.searchWarningText}>
                    {t("ask.webSearchCost")}
                  </Text>
                </View>
              ) : (
                <Text style={styles.searchHint}>
                  {t("ask.webSearchUnavailable")}
                </Text>
              )}
            </>
          )}
        </AnimatedBlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
  positioner: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    height: "85%",
    overflow: "hidden",
    backgroundColor: "transparent",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  sheetTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8,10,14,0.88)",
  },
  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerActions: { flexDirection: "row", gap: 20 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.accent, fontSize: 11, marginTop: 2 },
  quote: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: radii.medium,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  quoteLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  quoteText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  removeQuote: { color: colors.dim, fontSize: 11, marginTop: 5 },
  messages: { flex: 1 },
  messageContent: { padding: 14, gap: 10 },
  empty: {
    color: colors.dim,
    textAlign: "center",
    marginTop: 48,
    lineHeight: 22,
  },
  userMessage: {
    alignSelf: "flex-end",
    maxWidth: "86%",
    padding: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    backgroundColor: "#7c3aed",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    maxWidth: "94%",
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: "rgba(27,29,36,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  messageText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  sources: {
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sourceText: { color: colors.accent, fontSize: 11, marginTop: 3 },
  retryText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  workingStatus: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  workingCopy: { flex: 1 },
  workingText: { color: colors.textSecondary, fontSize: 13 },
  workingDetail: { color: colors.dim, fontSize: 10, marginTop: 2 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginHorizontal: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(27,29,36,0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toolButtonActive: { backgroundColor: "rgba(124,58,237,0.18)" },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 112,
    color: colors.text,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
  },
  searchHint: {
    color: colors.dim,
    fontSize: 10,
    textAlign: "center",
    marginTop: 5,
  },
  searchWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginHorizontal: 16,
    marginTop: 5,
  },
  searchWarningText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 10,
    textAlign: "center",
  },
  setup: {
    margin: 18,
    padding: 18,
    borderRadius: radii.large,
    backgroundColor: colors.surface,
  },
  setupTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  setupBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  setupButton: {
    marginTop: 14,
    padding: 12,
    borderRadius: radii.medium,
    backgroundColor: colors.text,
  },
  setupButtonText: {
    color: colors.background,
    textAlign: "center",
    fontWeight: "700",
  },
});
