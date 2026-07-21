import { describe, expect, test } from "bun:test";
import type { PaperDocument } from "@/features/viewer/paperDocument";
import {
  buildPaperChunks,
  buildAskContext,
  MAX_CONTEXT_CHARS,
  cosineSimilarity,
  decodeVector,
  encodeVector,
  rankChunks,
  embeddingFingerprint,
} from "./askCore";

const document: PaperDocument = {
  version: 1,
  arxivId: "1",
  sourceUrl: "https://example.com",
  sourceHash: "hash",
  blocks: [
    {
      id: "heading",
      anchorIds: [],
      kind: "heading",
      markdown: "## Intro",
      plainText: "Intro",
      protectedTokens: [],
      sectionTitle: "Intro",
    },
    {
      id: "a",
      anchorIds: [],
      kind: "paragraph",
      markdown: "hello",
      plainText: "hello",
      protectedTokens: [],
      sectionTitle: "Intro",
    },
    {
      id: "b",
      anchorIds: [],
      kind: "paragraph",
      markdown: "x".repeat(1400),
      plainText: "x".repeat(1400),
      protectedTokens: [],
    },
  ],
};

describe("Ask RAG core", () => {
  test("splits long paper blocks with overlap", () => {
    const chunks = buildPaperChunks(document);
    expect(chunks.map((chunk) => chunk.id)).toEqual(["a", "b:0", "b:1"]);
    expect(chunks[1]?.text.length).toBe(1200);
    expect(chunks[2]?.text.length).toBe(350);
  });

  test("does not let standalone headings consume semantic retrieval slots", () => {
    const chunks = buildPaperChunks(document);
    expect(chunks.some((chunk) => chunk.id === "heading")).toBe(false);
    expect(chunks[0]?.sectionTitle).toBe("Intro");
  });

  test("round-trips float vectors and ranks by cosine similarity", () => {
    const vector = decodeVector(encodeVector([1, 0, 0]));
    expect(Array.from(vector)).toEqual([1, 0, 0]);
    expect(cosineSimilarity(vector, new Float32Array([1, 0, 0]))).toBe(1);
    const chunks = buildPaperChunks(document).slice(0, 2);
    expect(
      rankChunks(new Float32Array([1, 0]), [
        { chunk: chunks[1]!, vector: new Float32Array([0, 1]) },
        { chunk: chunks[0]!, vector: new Float32Array([1, 0]) },
      ])[0]?.id,
    ).toBe("a");
  });

  test("keeps the current question and recent chat inside the context limit", () => {
    const context = buildAskContext({
      paper: {
        arxivId: "1",
        title: "Paper",
        abstract: "abstract",
        authors: [],
        categories: [],
        published: "",
        updated: "",
        pdfUrl: "",
      },
      question: "CURRENT-QUESTION",
      retrieved: [
        {
          id: "huge",
          blockId: "huge",
          ordinal: 0,
          text: "x".repeat(80_000),
        },
      ],
      recentMessages: [
        {
          id: "m",
          arxivId: "1",
          role: "user",
          content: "RECENT-MESSAGE",
          status: "complete",
          createdAt: 1,
        },
      ],
    });
    expect(context.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    expect(context).toContain("CURRENT-QUESTION");
    expect(context).toContain("RECENT-MESSAGE");
  });

  test("isolates vectors by normalized endpoint and model", () => {
    expect(embeddingFingerprint("https://example.com/v1/", " embed-v2 ")).toBe(
      "https://example.com/v1::embed-v2",
    );
  });
});
