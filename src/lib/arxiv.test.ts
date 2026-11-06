import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPaperPage, parseAtomFeed } from "./arxiv";

const fixture = readFileSync(
  join(import.meta.dir, "__fixtures__", "arxiv-feed.xml"),
  "utf8",
);

describe("arXiv Atom parser", () => {
  test("parses namespaced feeds, entities, CDATA, and legacy ids", () => {
    const page = parseAtomFeed(fixture, 20);
    expect(page.total).toBe(3);
    expect(page.start).toBe(20);
    expect(page.papers).toHaveLength(2);
    expect(page.papers[0]).toMatchObject({
      arxivId: "2607.01234v2",
      title: "Paper & Prism",
      abstract: "Research & discovery with α signals.",
      authors: ["Ada Lovelace", "Alan Turing"],
      categories: ["cs.AI", "cs.HC"],
    });
    expect(page.papers[1]).toMatchObject({
      arxivId: "hep-th/9901001v1",
      updated: "1999-01-04T00:00:00Z",
    });
  });

  test("skips a malformed entry without discarding valid papers", () => {
    expect(
      parseAtomFeed(fixture, 0).papers.map((paper) => paper.arxivId),
    ).toEqual(["2607.01234v2", "hep-th/9901001v1"]);
  });
});

describe("arXiv requests", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("a stalled request fails with a deadline instead of hanging", async () => {
    // Every arXiv request shares one queue, so a request that never settles
    // would block the feed, search, and reader behind it.
    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as typeof fetch;

    await expect(fetchPaperPage({ timeoutMs: 5 })).rejects.toThrow(
      "arXiv request timed out",
    );
  });
});
