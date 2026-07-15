import { describe, expect, test } from "bun:test";
import { isPaperDocument, restoreProtectedTokens } from "./paperDocument";

const validDocument = {
  version: 1,
  arxivId: "1234.5678",
  sourceUrl: "https://arxiv.org/html/1234.5678",
  sourceHash: "abc",
  blocks: [
    {
      id: "p1",
      anchorIds: ["p1"],
      kind: "paragraph",
      markdown: "Value $x$.",
      plainText: "Value x.",
      translationSource: "Value [[AT_MATH_0]].",
      protectedTokens: [{ marker: "[[AT_MATH_0]]", markdown: "$x$" }],
    },
  ],
};

describe("paper document boundary", () => {
  test("accepts the complete versioned shape and rejects malformed nested data", () => {
    expect(isPaperDocument(validDocument)).toBe(true);
    expect(
      isPaperDocument({
        ...validDocument,
        blocks: [{ ...validDocument.blocks[0], protectedTokens: [{}] }],
      }),
    ).toBe(false);
    expect(
      isPaperDocument({
        ...validDocument,
        blocks: [
          { ...validDocument.blocks[0], assets: [{ uri: 1, alt: "x" }] },
        ],
      }),
    ).toBe(false);
  });

  test("never accepts duplicated or missing protected markers", () => {
    const tokens = validDocument.blocks[0]!.protectedTokens;
    expect(restoreProtectedTokens("值 [[AT_MATH_0]]。", tokens)).toBe(
      "值 $x$。",
    );
    expect(() =>
      restoreProtectedTokens("[[AT_MATH_0]] [[AT_MATH_0]]", tokens),
    ).toThrow("protected token");
  });
});
