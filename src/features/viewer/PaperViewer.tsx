import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  resolveTranslateLang,
  type TranslateLangPref,
} from "@/lib/storage";
import type { Paper } from "@/types/paper";

type Props = {
  paper: Paper | null;
  translateLangPref: TranslateLangPref;
  onClose: () => void;
};

function paperUri(arxivId: string, translated: boolean, tl: string) {
  const origin = `https://arxiv.org/html/${arxivId}`;
  if (!translated) return origin;
  const u = encodeURIComponent(origin);
  return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(tl)}&hl=${encodeURIComponent(tl)}&u=${u}`;
}

export function PaperViewer({ paper, translateLangPref, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tl = useMemo(
    () => resolveTranslateLang(translateLangPref),
    [translateLangPref],
  );
  const [loading, setLoading] = useState(true);
  const [translated, setTranslated] = useState(false);

  useEffect(() => {
    if (!paper) return;
    setTranslated(false);
    setLoading(true);
  }, [paper?.id]);

  const uri = paper ? paperUri(paper.arxivId, translated, tl) : null;

  return (
    <Modal
      visible={paper != null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <WebView
          key={uri ?? "empty"}
          source={uri ? { uri } : undefined}
          style={styles.web}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
          startInLoadingState
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={["*"]}
          mixedContentMode="always"
        />

        <View
          style={[styles.bar, { paddingTop: Math.max(insets.top, 8) }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={onClose} hitSlop={10} style={styles.chip}>
            <Text style={styles.chipText}>{t("common.back")}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTranslated((v) => !v);
              setLoading(true);
            }}
            hitSlop={10}
            style={styles.chip}
          >
            <Text style={styles.chipText}>
              {translated ? t("common.original") : t("common.translate")}
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
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  web: {
    flex: 1,
    backgroundColor: "#fff",
  },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipText: {
    color: "#18181b",
    fontSize: 15,
    fontWeight: "600",
  },
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
});
