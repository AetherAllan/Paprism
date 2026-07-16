import { describe, expect, test } from "bun:test";
import type { ReadingState } from "@/features/ask/askTypes";
import type { PaperDocument } from "./paperDocument";
import { resolveInitialReaderPosition } from "./readerPosition";

const document = {
  version: 1,
  arxivId: "paper",
  sourceUrl: "https://example.com",
  sourceHash: "hash",
  blocks: ["summary", "methods", "results"].map((id) => ({
    id,
    anchorIds: [],
    kind: "paragraph" as const,
    markdown: id,
    plainText: id,
    protectedTokens: [],
  })),
} satisfies PaperDocument;

const saved = {
  arxivId: "paper",
  feedOffset: 0,
  readerBlockId: "methods",
} satisfies ReadingState;

describe("reader position", () => {
  test("restores the saved block instead of the document top", () => {
    expect(resolveInitialReaderPosition(document, saved)).toEqual({
      blockIndex: 1,
      blockId: "methods",
    });
  });

  test("falls back to the document top when the block no longer exists", () => {
    expect(resolveInitialReaderPosition(document, {
      ...saved,
      readerBlockId: "missing",
    })).toEqual({ blockIndex: 0, blockId: null });
  });
});
