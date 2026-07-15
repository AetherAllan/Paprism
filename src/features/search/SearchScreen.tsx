import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import SearchIcon from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import { useTranslation } from "react-i18next";
import { SectionFrame } from "@/features/menu/SectionFrame";
import { colors, radii } from "@/shared/theme";
import type { Paper } from "@/types/paper";
import { SearchResultRow } from "./SearchResultRow";
import { usePaperSearch } from "./usePaperSearch";

type Props = {
  visible: boolean;
  categories: string[];
  isSaved: (arxivId: string) => boolean;
  hasOfflinePaper: (arxivId: string) => boolean;
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
  hasOfflinePaper,
  hasPdf,
  onRead,
  onToggleSave,
  onDownload,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const search = usePaperSearch(categories);
  const listRef = useRef<FlatList<Paper>>(null);
  const scrollOffset = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: scrollOffset.current,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (search.state.status !== "idle") return;
    scrollOffset.current = 0;
  }, [search.state.generation, search.state.status]);

  const submit = () => {
    if (!search.submit()) return;
    scrollOffset.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const footer =
    search.state.paginationStatus === "loading" ? (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.muted} />
        <Text style={styles.muted}>{t("common.loadingMore")}</Text>
      </View>
    ) : search.state.paginationStatus === "error" ? (
      <Pressable style={styles.footer} onPress={() => search.loadMore(true)}>
        <Text style={styles.error}>{t("common.retryMore")}</Text>
        <Text style={styles.errorDetail}>{search.state.paginationError}</Text>
      </Pressable>
    ) : search.state.paginationStatus === "exhausted" &&
      search.state.papers.length > 0 ? (
      <Text style={styles.end}>
        {t("search.end", { count: search.state.papers.length })}
      </Text>
    ) : null;

  return (
    <SectionFrame
      visible={visible}
      title={t("menu.search")}
      onBackComplete={onBack}
    >
      <View style={styles.root}>
        <View style={styles.searchRow}>
          <View style={styles.inputShell}>
            <SearchIcon color={colors.dim} size={18} strokeWidth={1.8} />
            <TextInput
              value={search.query}
              onChangeText={search.setQuery}
              onSubmitEditing={submit}
              placeholder={t("search.placeholder")}
              placeholderTextColor={colors.dim}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={200}
              style={styles.input}
            />
          </View>
          <Pressable
            onPress={submit}
            disabled={!search.pendingQuery}
            accessibilityLabel={t("menu.search")}
            style={({ pressed }) => [
              styles.searchButton,
              !search.pendingQuery && styles.disabled,
              pressed && search.pendingQuery && styles.primaryPressed,
            ]}
          >
            <SearchIcon color={colors.inverse} size={19} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.scope}>
          {(["all", "categories"] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => search.setScope(id)}
              style={[
                styles.scopeButton,
                search.scope === id && styles.scopeActive,
              ]}
            >
              <Text
                style={[
                  styles.scopeText,
                  search.scope === id && styles.scopeTextActive,
                ]}
              >
                {t(id === "all" ? "search.scopeAll" : "search.scopeCategories")}
              </Text>
            </Pressable>
          ))}
        </View>

        {search.state.status === "idle" ? (
          <View style={styles.emptyState}>
            <SearchIcon color={colors.dim} size={28} strokeWidth={1.4} />
            <Text style={styles.empty}>{t("search.hint")}</Text>
          </View>
        ) : search.state.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.muted}>{t("search.loading")}</Text>
          </View>
        ) : search.state.status === "error" ? (
          <View style={styles.center}>
            <Text style={styles.error}>{t("search.failed")}</Text>
            <Text style={styles.errorDetail}>{search.state.error}</Text>
            <Pressable style={styles.retry} onPress={submit}>
              <Text style={styles.retryText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : search.state.papers.length === 0 ? (
          <View style={styles.emptyState}>
            <SearchX color={colors.dim} size={28} strokeWidth={1.4} />
            <Text style={styles.empty}>{t("search.empty")}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={search.state.papers}
            keyExtractor={(paper) => paper.arxivId}
            renderItem={({ item }) => (
              <SearchResultRow
                paper={item}
                saved={isSaved(item.arxivId)}
                downloaded={
                  hasOfflinePaper(item.arxivId) || hasPdf(item.arxivId)
                }
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
            onEndReached={() => search.loadMore(false)}
            onEndReachedThreshold={0.25}
            ListFooterComponent={footer}
          />
        )}
      </View>
    </SectionFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  inputShell: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 10,
    fontSize: 15,
  },
  searchButton: {
    width: 46,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    borderRadius: radii.medium,
  },
  disabled: { opacity: 0.35 },
  primaryPressed: { opacity: 0.82 },
  scope: {
    flexDirection: "row",
    margin: 12,
    marginHorizontal: 16,
    padding: 3,
    borderRadius: radii.medium,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  scopeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radii.small,
  },
  scopeActive: { backgroundColor: colors.surfacePressed },
  scopeText: { color: colors.dim, fontSize: 13, fontWeight: "600" },
  scopeTextActive: { color: colors.text },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  emptyState: {
    alignItems: "center",
    gap: 12,
    marginTop: 48,
    paddingHorizontal: 24,
  },
  empty: { color: colors.dim, textAlign: "center" },
  muted: { color: colors.dim, fontSize: 13 },
  error: { color: colors.danger, fontWeight: "600" },
  errorDetail: { color: colors.dim, fontSize: 12, textAlign: "center" },
  retry: {
    backgroundColor: colors.surfacePressed,
    borderRadius: radii.medium,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: { color: colors.text, fontWeight: "600" },
  results: { paddingHorizontal: 16, paddingBottom: 32, gap: 9 },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 22,
  },
  end: {
    color: colors.dim,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 22,
  },
});
