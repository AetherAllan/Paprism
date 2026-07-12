import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeCategories } from "@/lib/categories";
import { fetchPaperPage } from "@/lib/arxiv";
import i18n from "@/i18n";
import type { Paper } from "@/types/paper";

/** How many papers per arXiv request. */
const PAGE_SIZE = 30;
/**
 * When fewer than this many items remain ahead of the user,
 * kick off the next page fetch (optimistic prefetch).
 */
const PREFETCH_AHEAD = 12;

type Status = "idle" | "loading" | "ready" | "error";
export type PaginationStatus = "idle" | "loading" | "error" | "exhausted";

function catsKey(cats: string[]): string {
  return normalizeCategories(cats).slice().sort().join("|");
}

export function usePaperFeed(categories: string[]) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [paginationStatus, setPaginationStatus] =
    useState<PaginationStatus>("idle");
  const [paginationError, setPaginationError] = useState<string | null>(null);

  const nextStart = useRef(0);
  const total = useRef<number | null>(null);
  const inFlight = useRef(false);
  const seenIds = useRef(new Set<string>());
  const categoriesRef = useRef(normalizeCategories(categories));
  const papersLen = useRef(0);
  const generation = useRef(0);
  const key = catsKey(categories);

  useEffect(() => {
    papersLen.current = papers.length;
  }, [papers.length]);

  const loadMore = useCallback(async (isReset = false) => {
    if (inFlight.current) return;
    if (
      !isReset &&
      total.current !== null &&
      nextStart.current >= total.current
    ) {
      return;
    }

    const gen = generation.current;
    inFlight.current = true;
    if (isReset || papersLen.current === 0) {
      setStatus("loading");
    } else {
      setPaginationStatus("loading");
      setPaginationError(null);
    }
    setError(null);

    try {
      const start = isReset ? 0 : nextStart.current;
      const page = await fetchPaperPage({
        categories: categoriesRef.current,
        start,
        maxResults: PAGE_SIZE,
      });

      if (gen !== generation.current) return;

      total.current = page.total;
      nextStart.current = start + page.papers.length;

      const fresh = page.papers.filter((p) => {
        if (seenIds.current.has(p.arxivId)) return false;
        seenIds.current.add(p.arxivId);
        return true;
      });

      // Keep the ref authoritative between two awaited page loads. React may
      // not have committed the state update before the next request starts.
      papersLen.current = isReset
        ? fresh.length
        : papersLen.current + fresh.length;
      setPapers((prev) => (isReset ? fresh : [...prev, ...fresh]));
      setStatus("ready");
      setPaginationStatus(
        nextStart.current >= page.total || page.papers.length === 0
          ? "exhausted"
          : "idle",
      );
    } catch (e) {
      if (gen !== generation.current) return;
      const msg =
        e instanceof Error ? e.message : i18n.t("common.failedLoadPapers");
      if (papersLen.current === 0) {
        setError(msg);
        setStatus("error");
      } else {
        setPaginationError(msg);
        setPaginationStatus("error");
      }
    } finally {
      if (gen === generation.current) {
        inFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    categoriesRef.current = normalizeCategories(categories);
    generation.current += 1;
    inFlight.current = false;
    seenIds.current = new Set();
    nextStart.current = 0;
    total.current = null;
    papersLen.current = 0;
    setPapers([]);
    setIndex(0);
    setStatus("idle");
    setPaginationStatus("idle");
    setPaginationError(null);

    let cancelled = false;
    (async () => {
      await loadMore(true);
      if (cancelled) return;
      await loadMore(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, loadMore]);

  useEffect(() => {
    if (status !== "ready" || papers.length === 0) return;
    const remaining = papers.length - 1 - index;
    if (remaining <= PREFETCH_AHEAD) {
      void loadMore(false);
    }
  }, [index, papers.length, status, loadMore]);

  const onIndexChange = useCallback((next: number) => {
    setIndex(next);
  }, []);

  const retry = useCallback(() => {
    if (papersLen.current === 0) {
      void loadMore(true);
    } else {
      void loadMore(false);
    }
  }, [loadMore]);

  return {
    papers,
    status,
    error,
    index,
    paginationStatus,
    paginationError,
    prefetching: paginationStatus === "loading",
    onIndexChange,
    retry,
    hasMore: paginationStatus !== "exhausted",
  };
}
