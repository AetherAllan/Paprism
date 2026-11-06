import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import SearchIcon from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useTranslation } from "react-i18next";
import { SectionFrame } from "@/features/menu/SectionFrame";
import { colors, radii, typography } from "@/shared/theme";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PressableScale } from "@/shared/ui/PressableScale";
import { SearchField } from "@/shared/ui/SearchField";
import { Segmented } from "@/shared/ui/Segmented";
import type { Paper } from "@/types/paper";
import { SearchResultRow } from "./SearchResultRow";
import type { SearchScope } from "./searchCore";
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

const keyExtractor = (paper: Paper) => paper.arxivId;

export const SearchScreen = memo(function SearchScreen({
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
  const scopeOptions = useMemo(
    () =>
      [
        { id: "all", label: t("search.scopeAll") },
        { id: "categories", label: t("search.scopeCategories") },
      ] as const satisfies readonly { id: SearchScope; label: string }[],
    [t],
  );

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
    // Any fresh result set starts at the top, including one triggered by
    // changing the scope rather than by submitting the field.
    if (search.state.status !== "idle" && search.state.status !== "loading") {
      return;
    }
    scrollOffset.current = 0;
  }, [search.state.generation, search.state.status]);

  const submit = () => {
    if (!search.submit()) return;
    scrollOffset.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Paper>) => (
      <SearchResultRow
        paper={item}
        saved={isSaved(item.arxivId)}
        downloaded={hasOfflinePaper(item.arxivId) || hasPdf(item.arxivId)}
        onRead={onRead}
        onToggleSave={onToggleSave}
        onDownload={onDownload}
      />
    ),
    [hasOfflinePaper, hasPdf, isSaved, onDownload, onRead, onToggleSave],
  );

  const footer =
    search.state.paginationStatus === "loading" ? (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>{t("common.loadingMore")}</Text>
      </View>
    ) : search.state.paginationStatus === "error" ? (
      <Pressable
        accessibilityRole="button"
        style={styles.footer}
        onPress={() => search.loadMore(true)}
      >
        <Text style={styles.footerError}>{t("common.retryMore")}</Text>
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
          <SearchField
            value={search.query}
            onChangeText={search.setQuery}
            onSubmitEditing={submit}
            placeholder={t("search.placeholder")}
            returnKeyType="search"
            maxLength={200}
            style={styles.field}
          />
          <PressableScale
            accessibilityLabel={t("menu.search")}
            accessibilityState={{ disabled: !search.pendingQuery }}
            disabled={!search.pendingQuery}
            onPress={submit}
            scaleTo={0.92}
            style={[
              styles.searchButton,
              !search.pendingQuery && styles.searchButtonDisabled,
            ]}
          >
            <ArrowRight color={colors.inverse} size={20} strokeWidth={2} />
          </PressableScale>
        </View>

        <Segmented
          options={scopeOptions}
          value={search.scope}
          onChange={search.setScope}
          style={styles.scope}
        />

        {search.state.status === "idle" ? (
          <EmptyState
            icon={SearchIcon}
            body={t("search.hint")}
            style={styles.state}
          />
        ) : search.state.status === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>{t("search.loading")}</Text>
          </View>
        ) : search.state.status === "error" ? (
          <EmptyState
            icon={TriangleAlert}
            tone="danger"
            title={t("search.failed")}
            body={search.state.error ?? undefined}
            style={styles.state}
          >
            <Button label={t("common.retry")} onPress={submit} />
          </EmptyState>
        ) : search.state.papers.length === 0 ? (
          <EmptyState
            icon={SearchX}
            body={t("search.empty")}
            style={styles.state}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={search.state.papers}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.results}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
            onEndReached={() => search.loadMore(false)}
            onEndReachedThreshold={0.25}
            ListFooterComponent={footer ?? undefined}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
          />
        )}
      </View>
    </SectionFrame>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  field: { flex: 1 },
  searchButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    borderRadius: radii.pill,
  },
  searchButtonDisabled: { opacity: 0.3 },
  scope: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
  },
  state: { flex: 1, paddingBottom: 96 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    paddingBottom: 96,
  },
  muted: { ...typography.caption, fontSize: 13, color: colors.dim },
  footerError: { ...typography.label, color: colors.danger },
  errorDetail: {
    ...typography.caption,
    color: colors.dim,
    textAlign: "center",
  },
  results: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 22,
  },
  end: {
    ...typography.caption,
    color: colors.dim,
    textAlign: "center",
    paddingVertical: 22,
  },
});
