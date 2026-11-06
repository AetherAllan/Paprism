import { DomUtils, parseDocument } from "htmlparser2";
import { isTag, type ChildNode, type Element } from "domhandler";
import type { Paper } from "../types/paper";
import { RateLimiter } from "./rateLimiter";
import { categoriesToSearchQuery } from "@/lib/categories";

const BASE = "https://export.arxiv.org/api/query";
export const ARXIV_PAGE_SIZE = 20;
/** Official ToU: no more than one request every three seconds. */
const MIN_GAP_MS = 3000;
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = "Paprism/1.0 (Android; educational; contact: local-dev)";

const limiter = new RateLimiter(MIN_GAP_MS);

/** Shared with PDF downloads so we stay within arXiv ToU. */
export function scheduleArxiv<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  return limiter.schedule(fn, signal);
}

export type FetchPageOptions = {
  /** Selected category ids; multiple → AND intersection. */
  categories?: string[];
  start?: number;
  maxResults?: number;
  query?: string;
  sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function fetchPaperPage(options: FetchPageOptions = {}): Promise<{
  papers: Paper[];
  total: number;
  start: number;
}> {
  const {
    categories = ["cs.LG"],
    start = 0,
    maxResults = ARXIV_PAGE_SIZE,
    query,
    sortBy = "submittedDate",
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  const searchQuery = query ?? categoriesToSearchQuery(categories);

  const params = new URLSearchParams({
    search_query: searchQuery,
    start: String(start),
    max_results: String(maxResults),
    sortBy,
    sortOrder: "descending",
  });

  const url = `${BASE}?${params.toString()}`;

  return limiter.schedule(async () => {
    // React Native's HTTP client has no default read timeout, and the limiter
    // runs requests one at a time. Without a deadline, a single stalled socket
    // would block the feed, search, and reader for the rest of the session.
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/atom+xml",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`arXiv HTTP ${res.status}`);
      }

      const xml = await res.text();
      return parseAtomFeed(xml, start);
    } catch (error) {
      // Callers ignore AbortError for navigation. A deadline must stay visible.
      if (timedOut && !signal?.aborted) {
        throw new Error("arXiv request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }, signal);
}

export function parseAtomFeed(
  xml: string,
  start: number,
): { papers: Paper[]; total: number; start: number } {
  const document = parseDocument(xml, { xmlMode: true, decodeEntities: true });
  const totalNode = findElements(
    document.children,
    (element) => localName(element) === "totalResults",
  )[0];
  const parsedTotal = totalNode
    ? Number(clean(DomUtils.textContent(totalNode)))
    : 0;
  const total = Number.isFinite(parsedTotal) ? parsedTotal : 0;
  const entries = findElements(
    document.children,
    (element) => localName(element) === "entry",
  );
  const papers = entries.map(parseEntry).filter((p): p is Paper => p !== null);

  return { papers, total, start };
}

function parseEntry(entry: Element): Paper | null {
  const idRaw = textOf(entry, "id");
  if (!idRaw) return null;

  const arxivId = normalizeArxivId(idRaw);
  if (!arxivId) return null;

  const title = clean(textOf(entry, "title") ?? "Untitled");
  const abstract = clean(textOf(entry, "summary") ?? "");
  const published = textOf(entry, "published") ?? "";
  const updated = textOf(entry, "updated") ?? published;

  const authors: string[] = [];
  const authorBlocks = findElements(
    entry.children,
    (element) => localName(element) === "author",
  );
  for (const block of authorBlocks) {
    const name = textOf(block, "name");
    if (name) authors.push(clean(name));
  }

  const categories = findElements(
    entry.children,
    (element) => localName(element) === "category",
  )
    .map((element) => element.attribs.term)
    .filter(
      (term): term is string =>
        !!term && !term.toLowerCase().startsWith("http"),
    );

  return {
    arxivId,
    title,
    abstract,
    authors,
    categories,
    published,
    updated,
    pdfUrl: `https://export.arxiv.org/pdf/${arxivId}`,
  };
}

function localName(element: Element): string {
  return element.name.split(":").at(-1) ?? element.name;
}

function findElements(
  nodes: ChildNode[],
  predicate: (element: Element) => boolean,
  output: Element[] = [],
): Element[] {
  for (const node of nodes) {
    if (!isTag(node)) continue;
    if (predicate(node)) output.push(node);
    findElements(node.children, predicate, output);
  }
  return output;
}

function textOf(element: Element, tag: string): string | null {
  const match = findElements(
    element.children,
    (child) => localName(child) === tag,
  )[0];
  return match ? DomUtils.textContent(match).trim() : null;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** http://arxiv.org/abs/2301.00001v1 → 2301.00001v1 */
function normalizeArxivId(idUrl: string): string | null {
  // Legacy identifiers contain one slash (for example hep-th/9901001), while
  // query strings and fragments are never part of the arXiv identifier.
  const m = idUrl.match(/arxiv\.org\/abs\/([^\s?#]+)/i);
  const candidate = m?.[1] ?? idUrl.trim();
  if (
    /^\d{4}\.\d{4,5}(v\d+)?$/.test(candidate) ||
    /^[a-z-]+(?:\.[a-z]{2})?\/\d{7}(v\d+)?$/i.test(candidate)
  ) {
    return candidate;
  }
  return null;
}
