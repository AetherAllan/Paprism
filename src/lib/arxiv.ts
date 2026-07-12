import type { Paper } from "../types/paper";
import { RateLimiter } from "./rateLimiter";
import { categoriesToSearchQuery } from "@/lib/categories";

const BASE = "https://export.arxiv.org/api/query";
/** Official ToU: no more than one request every three seconds. */
const MIN_GAP_MS = 3000;
const USER_AGENT = "ArxivTok/1.0 (Android; educational; contact: local-dev)";

const limiter = new RateLimiter(MIN_GAP_MS);

/** Shared with PDF downloads so we stay within arXiv ToU. */
export function scheduleArxiv<T>(fn: () => Promise<T>): Promise<T> {
  return limiter.schedule(fn);
}

export type FetchPageOptions = {
  /** Selected category ids; multiple → AND intersection. */
  categories?: string[];
  start?: number;
  maxResults?: number;
  query?: string;
};

export async function fetchPaperPage(options: FetchPageOptions = {}): Promise<{
  papers: Paper[];
  total: number;
  start: number;
}> {
  const {
    categories = ["cs.LG"],
    start = 0,
    maxResults = 30,
    query,
  } = options;

  const searchQuery = query ?? categoriesToSearchQuery(categories);

  const params = new URLSearchParams({
    search_query: searchQuery,
    start: String(start),
    max_results: String(maxResults),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const url = `${BASE}?${params.toString()}`;

  return limiter.schedule(async () => {
    const res = await fetch(url, {
      headers: {
        Accept: "application/atom+xml",
        "User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`arXiv HTTP ${res.status}`);
    }

    const xml = await res.text();
    return parseAtomFeed(xml, start);
  });
}

function parseAtomFeed(
  xml: string,
  start: number,
): { papers: Paper[]; total: number; start: number } {
  const totalMatch = xml.match(/opensearch:totalResults[^>]*>(\d+)/i);
  const total = totalMatch ? Number(totalMatch[1]) : 0;

  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const papers = entries.map(parseEntry).filter((p): p is Paper => p !== null);

  return { papers, total, start };
}

function parseEntry(entry: string): Paper | null {
  const idRaw = textOf(entry, "id");
  if (!idRaw) return null;

  const arxivId = normalizeArxivId(idRaw);
  if (!arxivId) return null;

  const title = clean(textOf(entry, "title") ?? "Untitled");
  const abstract = clean(textOf(entry, "summary") ?? "");
  const published = textOf(entry, "published") ?? "";
  const updated = textOf(entry, "updated") ?? published;

  const authors: string[] = [];
  const authorBlocks = entry.match(/<author>[\s\S]*?<\/author>/g) ?? [];
  for (const block of authorBlocks) {
    const name = textOf(block, "name");
    if (name) authors.push(clean(name));
  }

  const categories: string[] = [];
  const catRe = /<category[^>]*\bterm="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = catRe.exec(entry)) !== null) {
    if (m[1] && !m[1].startsWith("http")) {
      categories.push(m[1]);
    }
  }

  return {
    id: arxivId,
    arxivId,
    title,
    abstract,
    authors,
    categories,
    published,
    updated,
    absUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://export.arxiv.org/pdf/${arxivId}`,
  };
}

function textOf(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(re);
  return match ? decodeXml(match[1].trim()) : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** http://arxiv.org/abs/2301.00001v1 → 2301.00001v1 */
function normalizeArxivId(idUrl: string): string | null {
  const m = idUrl.match(/arxiv\.org\/abs\/([^\s/?#]+)/i);
  if (m) return m[1];
  const bare = idUrl.trim();
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(bare) || /^[a-z-]+\/\d+/i.test(bare)) {
    return bare;
  }
  return null;
}
