import { readAsStringAsync } from "expo-file-system/legacy";
import { scheduleArxiv } from "@/lib/arxiv";
import type { Paper } from "@/types/paper";
import { parseArxivHtml } from "./arxivHtmlParser";
import { isPaperDocument, type PaperDocument } from "./paperDocument";

const MAX_HTML_BYTES = 15 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "Paprism/1.0 (Android; educational; contact: local-dev)";

export type FetchedPaperHtml = {
  html: string;
  sourceUrl: string;
};

export async function fetchPaperHtml(
  paper: Paper,
  outerSignal?: AbortSignal,
): Promise<FetchedPaperHtml> {
  return scheduleArxiv(async () => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    outerSignal?.addEventListener("abort", abort, { once: true });
    if (outerSignal?.aborted) controller.abort();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`https://arxiv.org/html/${paper.arxivId}`, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "This paper has no arXiv HTML version"
            : `arXiv HTML HTTP ${response.status}`,
        );
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) {
        throw new Error("arXiv returned an unsupported paper format");
      }
      const declaredBytes = Number(response.headers.get("content-length") ?? 0);
      if (declaredBytes > MAX_HTML_BYTES) {
        throw new Error("arXiv HTML exceeds the 15 MB reader limit");
      }
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
        throw new Error("arXiv HTML exceeds the 15 MB reader limit");
      }
      return {
        html,
        sourceUrl: response.url || `https://arxiv.org/html/${paper.arxivId}`,
      };
    } catch (error) {
      // Callers intentionally ignore AbortError for navigation cancellation.
      // Convert only our internal deadline to a visible, retryable failure.
      if (timedOut && !outerSignal?.aborted) {
        throw new Error("arXiv HTML request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      outerSignal?.removeEventListener("abort", abort);
    }
  });
}

export async function loadPaperDocument(
  paper: Paper,
  sourceUri?: string,
  signal?: AbortSignal,
): Promise<PaperDocument> {
  if (sourceUri) {
    const raw = await readAsStringAsync(sourceUri);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      // Version-1 offline downloads are HTML. Parse them locally so existing
      // user downloads remain readable after the WebView removal.
    }
    if (isPaperDocument(parsed)) {
      if (parsed.arxivId !== paper.arxivId) {
        throw new Error("Offline document belongs to a different paper");
      }
      return parsed;
    }
    return parseArxivHtml(raw, paper.arxivId, sourceUri);
  }

  const source = await fetchPaperHtml(paper, signal);
  return parseArxivHtml(source.html, paper.arxivId, source.sourceUrl);
}
