import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import type { ProviderProfile } from "@/features/settings/providerCore";
import {
  resolveTranslateLang,
  type TranslateLangPref,
} from "@/lib/storage";
import type { Paper } from "@/types/paper";
import {
  blockCacheKey,
  parseWebViewMessage,
  translationCacheId,
  type TranslationBlock,
} from "./translationCore";
import {
  loadTranslationCache,
  saveTranslationCache,
  type TranslationCache,
} from "./translationCache";
import {
  bridgeCommand,
  buildTranslationBridge,
  type BridgeCommand,
} from "./translationBridge";
import { translateBlocks } from "./translator";

type Props = {
  paper: Paper | null;
  translateLangPref: TranslateLangPref;
  sourceUri?: string;
  providerProfile: ProviderProfile | null;
  getProviderApiKey: (profileId: string) => Promise<string | null>;
  onOpenSettings: () => void;
  onClose: () => void;
};

type Mode = "source" | "dual";

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
  const webView = useRef<WebViewType>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(new Map<string, TranslationBlock>());
  const failed = useRef(new Map<string, TranslationBlock>());
  const completed = useRef(new Set<string>());
  const cache = useRef<TranslationCache>({});
  const cacheReady = useRef<Promise<void>>(Promise.resolve());
  const processing = useRef(false);
  const modeRef = useRef<Mode>("source");
  const sessionRef = useRef("");

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("source");
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState({ completed: 0, pending: 0, failed: 0 });
  const [translationError, setTranslationError] = useState<string | null>(null);

  const targetLang = useMemo(
    () => resolveTranslateLang(translateLangPref),
    [translateLangPref],
  );
  const uri = paper ? sourceUri ?? `https://arxiv.org/html/${paper.arxivId}` : null;
  const session = useMemo(
    () =>
      `${paper?.arxivId ?? "none"}-${providerProfile?.id ?? "none"}-${providerProfile?.baseUrl ?? ""}-${providerProfile?.model ?? ""}-${Date.now().toString(36)}`,
    [paper?.arxivId, providerProfile?.baseUrl, providerProfile?.id, providerProfile?.model],
  );
  const cacheId = useMemo(
    () =>
      paper && providerProfile
        ? translationCacheId(paper, providerProfile, targetLang)
        : null,
    [paper, providerProfile, targetLang],
  );

  const refreshProgress = useCallback(() => {
    setProgress({
      completed: completed.current.size,
      pending: pending.current.size,
      failed: failed.current.size,
    });
  }, []);

  const send = useCallback((command: BridgeCommand) => {
    webView.current?.injectJavaScript(bridgeCommand(command));
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    controller.current?.abort();
    pending.current.clear();
    failed.current.clear();
    completed.current.clear();
    cache.current = {};
    processing.current = false;
    modeRef.current = "source";
    setMode("source");
    setTotal(0);
    setTranslationError(null);
    refreshProgress();
    cacheReady.current = cacheId
      ? loadTranslationCache(cacheId).then((loaded) => {
        if (sessionRef.current === session) cache.current = loaded;
      })
      : Promise.resolve();
    return () => controller.current?.abort();
  }, [cacheId, refreshProgress, session]);

  const drainQueue = useCallback(async () => {
    if (
      processing.current ||
      modeRef.current !== "dual" ||
      !providerProfile ||
      !cacheId
    ) {
      return;
    }
    processing.current = true;
    const expectedSession = sessionRef.current;
    try {
      const apiKey = await getProviderApiKey(providerProfile.id);
      if (!apiKey) throw new Error(t("translation.keyMissing"));
      while (pending.current.size > 0 && modeRef.current === "dual") {
        const batch = [...pending.current.values()].slice(0, 6);
        for (const block of batch) pending.current.delete(block.id);
        refreshProgress();
        const currentController = new AbortController();
        controller.current = currentController;
        try {
          const results = await translateBlocks(
            providerProfile,
            apiKey,
            targetLang,
            batch,
            currentController.signal,
          );
          if (sessionRef.current !== expectedSession || currentController.signal.aborted) return;
          send({ type: "translations", items: results });
          for (const result of results) {
            const source = batch.find((block) => block.id === result.id);
            if (!source) continue;
            completed.current.add(result.id);
            failed.current.delete(result.id);
            cache.current[blockCacheKey(source)] = result.text;
          }
          void saveTranslationCache(cacheId, cache.current);
          setTranslationError(null);
        } catch (error) {
          if (currentController.signal.aborted) return;
          for (const block of batch) failed.current.set(block.id, block);
          send({ type: "errors", ids: batch.map((block) => block.id) });
          setTranslationError(
            error instanceof Error ? error.message : t("common.unknownError"),
          );
        }
        refreshProgress();
      }
    } catch (error) {
      setTranslationError(
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    } finally {
      processing.current = false;
      controller.current = null;
      refreshProgress();
    }
  }, [cacheId, getProviderApiKey, providerProfile, refreshProgress, send, t, targetLang]);

  const enqueue = useCallback(
    async (blocks: TranslationBlock[]) => {
      if (modeRef.current !== "dual") return;
      const expectedSession = sessionRef.current;
      await cacheReady.current;
      if (sessionRef.current !== expectedSession || modeRef.current !== "dual") return;
      const cachedResults: { id: string; text: string }[] = [];
      for (const block of blocks) {
        if (
          completed.current.has(block.id) ||
          failed.current.has(block.id) ||
          pending.current.has(block.id)
        ) {
          continue;
        }
        const cached = cache.current[blockCacheKey(block)];
        if (cached) {
          completed.current.add(block.id);
          cachedResults.push({ id: block.id, text: cached });
        } else {
          pending.current.set(block.id, block);
        }
      }
      if (cachedResults.length > 0) {
        send({ type: "translations", items: cachedResults });
      }
      refreshProgress();
      void drainQueue();
    },
    [drainQueue, refreshProgress, send],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseWebViewMessage(event.nativeEvent.data);
      if (!message || message.session !== sessionRef.current) return;
      if (message.type === "ready") {
        setTotal(message.total);
        if (modeRef.current === "dual") send({ type: "scan" });
      } else {
        void enqueue(message.blocks);
      }
    },
    [enqueue, send],
  );

  const toggleMode = async () => {
    if (modeRef.current === "dual") {
      controller.current?.abort();
      pending.current.clear();
      modeRef.current = "source";
      setMode("source");
      send({ type: "mode", mode: "source" });
      refreshProgress();
      return;
    }
    if (!providerProfile || !(await getProviderApiKey(providerProfile.id))) {
      Alert.alert(t("translation.setupTitle"), t("translation.setupBody"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.settings"), onPress: onOpenSettings },
      ]);
      return;
    }
    modeRef.current = "dual";
    setMode("dual");
    send({ type: "mode", mode: "dual" });
    send({ type: "scan" });
  };

  const retryFailed = () => {
    for (const block of failed.current.values()) pending.current.set(block.id, block);
    failed.current.clear();
    setTranslationError(null);
    refreshProgress();
    void drainQueue();
  };

  const cancelTranslation = () => {
    controller.current?.abort();
    pending.current.clear();
    refreshProgress();
  };

  return (
    <Modal
      visible={paper != null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <WebView
          ref={webView}
          key={`${uri ?? "empty"}-${session}`}
          source={uri ? { uri } : undefined}
          injectedJavaScript={buildTranslationBridge(session)}
          onMessage={onMessage}
          style={styles.web}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
          startInLoadingState
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={["https://arxiv.org", "file://*"]}
          mixedContentMode="never"
          allowFileAccess
          allowUniversalAccessFromFileURLs={false}
          onShouldStartLoadWithRequest={(request) => {
            if (!sourceUri || request.url.startsWith("file:") || request.url === "about:blank") {
              return true;
            }
            if (/^https?:/i.test(request.url)) void Linking.openURL(request.url);
            return false;
          }}
        />

        <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={10} style={styles.chip}>
            <Text style={styles.chipText}>{t("common.back")}</Text>
          </Pressable>
          <View style={styles.statusBox}>
            {mode === "dual" ? (
              <Text style={styles.statusText} numberOfLines={1}>
                {progress.completed}/{total || "—"}
                {progress.pending ? ` · ${t("translation.pending", { count: progress.pending })}` : ""}
              </Text>
            ) : null}
            {translationError ? (
              <Pressable onPress={retryFailed} hitSlop={8}>
                <Text style={styles.errorText}>{t("translation.retryFailed")}</Text>
              </Pressable>
            ) : progress.pending > 0 ? (
              <Pressable onPress={cancelTranslation} hitSlop={8}>
                <Text style={styles.cancelText}>{t("common.cancel")}</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={() => void toggleMode()} hitSlop={10} style={styles.chip}>
            <Text style={styles.chipText}>
              {mode === "dual" ? t("common.original") : t("common.translate")}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator color="#18181b" size="large" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  web: { flex: 1, backgroundColor: "#fff" },
  bar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 6 },
  chip: { backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6 },
  chipText: { color: "#18181b", fontSize: 14, fontWeight: "600" },
  statusBox: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, maxWidth: "55%" },
  statusText: { color: "#52525b", fontSize: 11 },
  errorText: { color: "#dc2626", fontSize: 11, fontWeight: "600", marginTop: 2 },
  cancelText: { color: "#71717a", fontSize: 11, fontWeight: "600", marginTop: 2 },
  spinner: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.55)" },
});
