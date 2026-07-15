import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Paper } from "@/types/paper";

const values = new Map<string, string>();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  },
}));

const { HISTORY_CAP, loadPdfDownloads, upsertHistory } =
  await import("./library");

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

describe("download metadata migration", () => {
  beforeEach(() => values.clear());

  test("moves legacy PDF rows without retaining duplicate Paper fields", async () => {
    values.set(
      "arxivtok.downloads",
      JSON.stringify([
        {
          id: "legacy-duplicate",
          arxivId: "1234.5678v2",
          title: "Paper",
          authors: ["Ada"],
          localUri: "file:///paper.pdf",
          exportUri: "content://paper.pdf",
          downloadedAt: 42,
        },
      ]),
    );

    const result = await loadPdfDownloads();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      arxivId: "1234.5678v2",
      localUri: "file:///paper.pdf",
      exported: true,
    });
    expect(values.has("arxivtok.downloads")).toBe(false);
    expect(
      JSON.parse(values.get("arxivtok.pdfDownloads") ?? "[]")[0],
    ).not.toHaveProperty("id");
  });
});

describe("paper history", () => {
  test("deduplicates revisits, moves them first, and enforces the cap", () => {
    let history = upsertHistory([], paper("first"));
    history = upsertHistory(history, paper("second"));
    history = upsertHistory(history, paper("first"));

    expect(history.map((item) => item.arxivId)).toEqual(["first", "second"]);

    history = [];
    for (let index = 0; index < HISTORY_CAP + 5; index += 1) {
      history = upsertHistory(history, paper(String(index)));
    }
    expect(history).toHaveLength(HISTORY_CAP);
    expect(history[0]?.arxivId).toBe(String(HISTORY_CAP + 4));
  });
});
