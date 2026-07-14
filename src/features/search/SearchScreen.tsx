import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchPaperPage } from "@/lib/arxiv";
import { categoriesToSearchQuery } from "@/lib/categories";
import type { Paper } from "@/types/paper";
import {
  buildSearchQuery,
  initialSearchState,
  searchReducer,
  type SearchScope,
} from "./searchCore";

const PAGE_SIZE = 30;

type Props = {
  visible: boolean;
  categories: string[];
  isSaved: (arxivId: string) => boolean;
  hasOfflineHtml: (arxivId: string) => boolean;
  hasPdf: (arxivId: string) => boolean;
  onRead: (paper: Paper) => void;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
  onBack: () => void;
};

export function SearchScreen({
  visible,
  categories,
  isSaved,
  hasOfflineHtml,
  hasPdf,
  onRead,
  onToggleSave,
  onDownload,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [state, dispatch] = useReducer(searchReducer, initialSearchState);
  const categoryKey = categoriesToSearchQuery(categories);
  const pendingQuery = buildSearchQuery(query, scope, categories);
  const listRef = useRef<FlatList<Paper>>(null);
  const scrollOffset = useRef(0);
  const generation = useRef(0);
  const active = useRef<{
    generation: number;
    query: string;
    scope: SearchScope;
    categoryKey: string;
  } | null>(null);
  const requests = useRef(new Set<string>());

  useEffect(() => {
    const current = active.current;
    if (
      !current ||
      current.scope !== "categories" ||
      current.categoryKey === categoryKey
    ) {
      return;
    }

    // Results labelled "current categories" must never continue paging with
    // the previous feed selection. Advancing the generation also rejects the
    // old request if it finishes after this reset.
    const generationId = ++generation.current;
    active.current = null;
    scrollOffset.current = 0;
    dispatch({ type: "clear", generation: generationId });
  }, [categoryKey]);

  const requestPage = useCallback(
    async (generationId: number, searchQuery: string, start: number, reset: boolean) => {
      const requestKey = `${generationId}:${start}`;
      if (requests.current.has(requestKey)) return;
      requests.current.add(requestKey);
      dispatch({ type: "request", generation: generationId, reset });

      try {
        const page = await fetchPaperPage({
          query: searchQuery,
          start,
          maxResults: PAGE_SIZE,
          sortBy: "relevance",
        });
        dispatch({
          type: "success",
          generation: generationId,
          start,
          total: page.total,
          papers: page.papers,
        });
      } catch (error) {
        dispatch({
          type: "failure",
          generation: generationId,
          error: error instanceof Error ? error.message : t("common.failedLoadPapers"),
        });
      } finally {
        requests.current.delete(requestKey);
      }
    },
    [t],
  );

  const submit = useCallback(() => {
    if (!pendingQuery) return;
    const current = active.current;
    if (
      current?.query === pendingQuery &&
      requests.current.has(`${current.generation}:0`)
    ) {
      return;
    }

    const generationId = ++generation.current;
    active.current = {
      generation: generationId,
      query: pendingQuery,
      scope,
      categoryKey,
    };
    scrollOffset.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    void requestPage(generationId, pendingQuery, 0, true);
  }, [categoryKey, pendingQuery, requestPage, scope]);

  const loadMore = useCallback(
    (retry = false) => {
      const current = active.current;
      if (!current || current.generation !== state.generation) return;
      if (state.paginationStatus === "loading" || state.paginationStatus === "exhausted") return;
      // A failed page should not be retried repeatedly by FlatList's
      // onEndReached callback. Only the visible retry control can resume it.
      if (state.paginationStatus === "error" && !retry) return;
      void requestPage(
        current.generation,
        current.query,
        state.nextStart,
        false,
      );
    },
    [requestPage, state.generation, state.nextStart, state.paginationStatus],
  );

  const footer =
    state.paginationStatus === "loading" ? (
      <View style={styles.footer}>
        <ActivityIndicator color="#a1a1aa" />
        <Text style={styles.muted}>{t("common.loadingMore")}</Text>
      </View>
    ) : state.paginationStatus === "error" ? (
      <Pressable style={styles.footer} onPress={() => loadMore(true)}>
        <Text style={styles.error}>{t("common.retryMore")}</Text>
        <Text style={styles.errorDetail}>{state.paginationError}</Text>
      </Pressable>
    ) : state.paginationStatus === "exhausted" && state.papers.length > 0 ? (
      <Text style={styles.end}>{t("search.end", { count: state.papers.length })}</Text>
    ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onBack}
      onShow={() =>
        listRef.current?.scrollToOffset({
          offset: scrollOffset.current,
          animated: false,
        })
      }
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("menu.search")}</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submit}
            placeholder={t("search.placeholder")}
            placeholderTextColor="#71717a"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={200}
            style={styles.input}
          />
          <Pressable
            onPress={submit}
            disabled={!pendingQuery}
            style={[styles.searchButton, !pendingQuery && styles.disabled]}
          >
            <Text style={styles.searchButtonText}>{t("menu.search")}</Text>
          </Pressable>
        </View>

        <View style={styles.scope}>
          {(["all", "categories"] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setScope(id)}
              style={[styles.scopeButton, scope === id && styles.scopeActive]}
            >
              <Text style={[styles.scopeText, scope === id && styles.scopeTextActive]}>
                {t(id === "all" ? "search.scopeAll" : "search.scopeCategories")}
              </Text>
            </Pressable>
          ))}
        </View>

        {state.status === "idle" ? (
          <Text style={styles.empty}>{t("search.hint")}</Text>
        ) : state.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color="#f4f4f5" />
            <Text style={styles.muted}>{t("search.loading")}</Text>
          </View>
        ) : state.status === "error" ? (
          <View style={styles.center}>
            <Text style={styles.error}>{t("search.failed")}</Text>
            <Text style={styles.errorDetail}>{state.error}</Text>
            <Pressable style={styles.retry} onPress={submit}>
              <Text style={styles.retryText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : state.papers.length === 0 ? (
          <Text style={styles.empty}>{t("search.empty")}</Text>
        ) : (
          <FlatList
            ref={listRef}
            data={state.papers}
            keyExtractor={(paper) => paper.arxivId}
            renderItem={({ item }) => (
              <ResultRow
                paper={item}
                saved={isSaved(item.arxivId)}
                downloaded={hasOfflineHtml(item.arxivId) || hasPdf(item.arxivId)}
                onRead={onRead}
                onToggleSave={onToggleSave}
                onDownload={onDownload}
              />
            )}
            contentContainerStyle={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
            onEndReached={() => loadMore(false)}
            onEndReachedThreshold={0.6}
            ListFooterComponent={footer}
          />
        )}
      </View>
    </Modal>
  );
}

function ResultRow({
  paper,
  saved,
  downloaded,
  onRead,
  onToggleSave,
  onDownload,
}: {
  paper: Paper;
  saved: boolean;
  downloaded: boolean;
  onRead: (paper: Paper) => void;
  onToggleSave: (paper: Paper) => void;
  onDownload: (paper: Paper) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => onRead(paper)} style={styles.result}>
      <Text style={styles.resultTitle}>{paper.title}</Text>
      <Text style={styles.authors} numberOfLines={1}>
        {paper.authors.slice(0, 3).join(", ")}
      </Text>
      <Text style={styles.abstract} numberOfLines={3}>
        {paper.abstract}
      </Text>
      <View style={styles.actions}>
        <Text style={styles.read}>{t("common.read")}</Text>
        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            onToggleSave(paper);
          }}
          hitSlop={8}
        >
          <Text style={styles.action}>{t(saved ? "common.saved" : "common.save")}</Text>
        </Pressable>
        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            onDownload(paper);
          }}
          hitSlop={8}
        >
          <Text style={styles.action}>
            {t(downloaded ? "common.downloaded" : "common.download")}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111113" },
  header: {
    minHeight: 40,
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: { color: "#fafafa", fontSize: 18, fontWeight: "700" },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  input: {
    flex: 1,
    backgroundColor: "#1c1c1f",
    borderRadius: 8,
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  searchButton: {
    justifyContent: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  searchButtonText: { color: "#18181b", fontWeight: "700" },
  disabled: { opacity: 0.35 },
  scope: {
    flexDirection: "row",
    margin: 12,
    marginHorizontal: 16,
    padding: 3,
    borderRadius: 8,
    backgroundColor: "#1c1c1f",
  },
  scopeButton: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 6 },
  scopeActive: { backgroundColor: "#27272a" },
  scopeText: { color: "#71717a", fontSize: 13, fontWeight: "600" },
  scopeTextActive: { color: "#fafafa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  empty: { color: "#71717a", textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
  muted: { color: "#71717a", fontSize: 13 },
  error: { color: "#f87171", fontWeight: "600" },
  errorDetail: { color: "#71717a", fontSize: 12, textAlign: "center" },
  retry: { backgroundColor: "#27272a", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: "#f4f4f5", fontWeight: "600" },
  results: { paddingHorizontal: 16, paddingBottom: 32 },
  result: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 5,
  },
  resultTitle: { color: "#f4f4f5", fontSize: 16, lineHeight: 21, fontWeight: "700" },
  authors: { color: "#a1a1aa", fontSize: 13 },
  abstract: { color: "#a1a1aa", fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 6 },
  read: { flex: 1, color: "#f4f4f5", fontSize: 13, fontWeight: "600" },
  action: { color: "#a1a1aa", fontSize: 13, fontWeight: "600" },
  footer: { alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 22 },
  end: { color: "#71717a", fontSize: 12, textAlign: "center", paddingVertical: 22 },
});
