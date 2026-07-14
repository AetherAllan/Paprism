import { describe, expect, test } from "bun:test";
import type { Paper } from "@/types/paper";
import {
  buildSearchQuery,
  initialSearchState,
  searchReducer,
} from "./searchCore";

const paper = (arxivId: string): Paper => ({
  arxivId,
  title: arxivId,
  abstract: "",
  authors: [],
  categories: ["cs.LG"],
  published: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
  pdfUrl: `https://export.arxiv.org/pdf/${arxivId}`,
});

describe("arXiv search", () => {
  test("sanitizes terms and optionally applies the current categories", () => {
    expect(buildSearchQuery('graph "agent"', "all", ["cs.LG"])).toBe(
      'all:"graph" AND all:"agent"',
    );
    expect(buildSearchQuery("graph agent", "categories", ["cs.LG", "stat.ML"])).toBe(
      '(all:"graph" AND all:"agent") AND (cat:cs.LG AND cat:stat.ML)',
    );
  });

  test("returns no query when sanitizing removes every term", () => {
    expect(buildSearchQuery("", "all", ["cs.LG"])).toBeNull();
    expect(buildSearchQuery('""', "all", ["cs.LG"])).toBeNull();
    expect(buildSearchQuery("\\\\", "categories", ["cs.LG"])).toBeNull();
  });

  test("clears a category search and ignores its late response", () => {
    const loading = searchReducer(initialSearchState, {
      type: "request",
      generation: 1,
      reset: true,
    });
    const cleared = searchReducer(loading, {
      type: "clear",
      generation: 2,
    });
    const late = searchReducer(cleared, {
      type: "success",
      generation: 1,
      start: 0,
      total: 1,
      papers: [paper("stale")],
    });

    expect(cleared.status).toBe("idle");
    expect(late).toEqual(cleared);
  });

  test("ignores late pages and keeps existing results on pagination failure", () => {
    const loading = searchReducer(initialSearchState, {
      type: "request",
      generation: 2,
      reset: true,
    });
    const firstPage = searchReducer(loading, {
      type: "success",
      generation: 2,
      start: 0,
      total: 3,
      papers: [paper("1"), paper("2")],
    });
    const latePage = searchReducer(firstPage, {
      type: "success",
      generation: 1,
      start: 2,
      total: 3,
      papers: [paper("stale")],
    });
    const pageLoading = searchReducer(latePage, {
      type: "request",
      generation: 2,
      reset: false,
    });
    const failed = searchReducer(pageLoading, {
      type: "failure",
      generation: 2,
      error: "HTTP 503",
    });

    expect(latePage.papers.map((item) => item.arxivId)).toEqual(["1", "2"]);
    expect(failed.papers.map((item) => item.arxivId)).toEqual(["1", "2"]);
    expect(failed.paginationStatus).toBe("error");
    expect(failed.paginationError).toBe("HTTP 503");
  });

  test("deduplicates optimistic pages and marks the end", () => {
    const first = searchReducer(
      searchReducer(initialSearchState, {
        type: "request",
        generation: 1,
        reset: true,
      }),
      {
        type: "success",
        generation: 1,
        start: 0,
        total: 3,
        papers: [paper("1"), paper("2")],
      },
    );
    const complete = searchReducer(
      searchReducer(first, {
        type: "request",
        generation: 1,
        reset: false,
      }),
      {
        type: "success",
        generation: 1,
        start: 2,
        total: 3,
        papers: [paper("2"), paper("3")],
      },
    );

    expect(complete.papers.map((item) => item.arxivId)).toEqual(["1", "2", "3"]);
    expect(complete.paginationStatus).toBe("exhausted");
  });
});
