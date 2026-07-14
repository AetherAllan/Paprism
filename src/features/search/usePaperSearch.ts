import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ARXIV_PAGE_SIZE, fetchPaperPage } from "@/lib/arxiv";
import { categoriesToSearchQuery } from "@/lib/categories";
import {
  buildSearchQuery,
  initialSearchState,
  searchReducer,
  type SearchScope,
} from "./searchCore";

export function usePaperSearch(categories: string[]) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [state, dispatch] = useReducer(searchReducer, initialSearchState);
  const generation = useRef(0);
  const active = useRef<{
    generation: number;
    query: string;
    scope: SearchScope;
    categoryKey: string;
  } | null>(null);
  const requests = useRef(new Set<string>());
  const categoryKey = categoriesToSearchQuery(categories);
  const pendingQuery = buildSearchQuery(query, scope, categories);

  useEffect(() => {
    const current = active.current;
    if (
      !current ||
      current.scope !== "categories" ||
      current.categoryKey === categoryKey
    ) {
      return;
    }

    // A result set labelled "current categories" cannot continue paging
    // after the feed filter changes. Advancing the generation also rejects a
    // response that was already in flight for the previous categories.
    const generationId = ++generation.current;
    active.current = null;
    dispatch({ type: "clear", generation: generationId });
  }, [categoryKey]);

  const requestPage = useCallback(
    async (
      generationId: number,
      searchQuery: string,
      start: number,
      reset: boolean,
    ) => {
      const requestKey = `${generationId}:${start}`;
      if (requests.current.has(requestKey)) return;
      requests.current.add(requestKey);
      dispatch({ type: "request", generation: generationId, reset });

      try {
        const page = await fetchPaperPage({
          query: searchQuery,
          start,
          maxResults: ARXIV_PAGE_SIZE,
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
          error:
            error instanceof Error
              ? error.message
              : t("common.failedLoadPapers"),
        });
      } finally {
        requests.current.delete(requestKey);
      }
    },
    [t],
  );

  const submit = useCallback((): boolean => {
    if (!pendingQuery) return false;
    const current = active.current;
    if (
      current?.query === pendingQuery &&
      requests.current.has(`${current.generation}:0`)
    ) {
      return false;
    }

    const generationId = ++generation.current;
    active.current = {
      generation: generationId,
      query: pendingQuery,
      scope,
      categoryKey,
    };
    void requestPage(generationId, pendingQuery, 0, true);
    return true;
  }, [categoryKey, pendingQuery, requestPage, scope]);

  const loadMore = useCallback(
    (retry = false) => {
      const current = active.current;
      if (!current || current.generation !== state.generation) return;
      if (
        state.paginationStatus === "loading" ||
        state.paginationStatus === "exhausted"
      ) {
        return;
      }
      // FlatList may call onEndReached repeatedly while it remains near the
      // bottom. Failed pages resume only from the visible retry control.
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

  return {
    query,
    setQuery,
    scope,
    setScope,
    state,
    pendingQuery,
    submit,
    loadMore,
  };
}
