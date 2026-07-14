import { categoriesToSearchQuery, normalizeCategories } from "@/lib/categories";
import type { Paper } from "@/types/paper";

export type SearchScope = "all" | "categories";
export type SearchStatus = "idle" | "loading" | "ready" | "error";
export type SearchPaginationStatus = "idle" | "loading" | "error" | "exhausted";

export type SearchState = {
  generation: number;
  papers: Paper[];
  total: number;
  nextStart: number;
  status: SearchStatus;
  error: string | null;
  paginationStatus: SearchPaginationStatus;
  paginationError: string | null;
};

export const initialSearchState: SearchState = {
  generation: 0,
  papers: [],
  total: 0,
  nextStart: 0,
  status: "idle",
  error: null,
  paginationStatus: "idle",
  paginationError: null,
};

type SearchAction =
  | { type: "clear"; generation: number }
  | { type: "request"; generation: number; reset: boolean }
  | {
      type: "success";
      generation: number;
      start: number;
      total: number;
      papers: Paper[];
    }
  | { type: "failure"; generation: number; error: string };

export function buildSearchQuery(
  input: string,
  scope: SearchScope,
  categories: string[],
): string | null {
  const value = input.trim();
  if (!value || value.length > 200) return null;

  // Treat user input as plain text, not arXiv query syntax. Quoting every term
  // prevents an accidental colon, parenthesis, or Boolean word from changing
  // the structure of the request.
  const safeTerms = value
    // The arXiv parser does not accept backslash-escaped nested quotes. Treat
    // quotes and backslashes as separators so plain user text cannot produce
    // a malformed query while the remaining punctuation stays searchable.
    .replace(/["\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (safeTerms.length === 0) return null;

  const terms = safeTerms
    .map((term) => `all:"${term}"`)
    .join(" AND ");

  const normalized = normalizeCategories(categories);
  if (scope === "all" || normalized.includes("all")) return terms;
  return `(${terms}) AND (${categoriesToSearchQuery(normalized)})`;
}

export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  if (action.type === "clear") {
    return { ...initialSearchState, generation: action.generation };
  }
  if (action.type === "request" && action.reset) {
    return {
      ...initialSearchState,
      generation: action.generation,
      status: "loading",
    };
  }
  // Search and scope changes can finish after a newer request. Never let an
  // old page replace or append to the visible result set.
  if (action.generation !== state.generation) return state;

  if (action.type === "request") {
    return {
      ...state,
      paginationStatus: "loading",
      paginationError: null,
    };
  }

  if (action.type === "failure") {
    return state.papers.length === 0
      ? { ...state, status: "error", error: action.error }
      : {
          ...state,
          paginationStatus: "error",
          paginationError: action.error,
        };
  }

  const papers = mergeUnique(
    action.start === 0 ? [] : state.papers,
    action.papers,
  );
  const nextStart = action.start + action.papers.length;
  return {
    ...state,
    papers,
    total: action.total,
    nextStart,
    status: "ready",
    error: null,
    paginationStatus:
      nextStart >= action.total || action.papers.length === 0
        ? "exhausted"
        : "idle",
    paginationError: null,
  };
}

function mergeUnique(existing: Paper[], incoming: Paper[]): Paper[] {
  const seen = new Set(existing.map((paper) => paper.arxivId));
  return [
    ...existing,
    ...incoming.filter((paper) => {
      if (seen.has(paper.arxivId)) return false;
      seen.add(paper.arxivId);
      return true;
    }),
  ];
}
