import { describe, expect, test } from "bun:test";
import {
  parseTranslationResponse,
  parseWebViewMessage,
  prepareTranslationBatches,
  reassembleTranslations,
} from "./translationCore";

describe("translation protocol", () => {
  test("rejects malformed WebView messages", () => {
    expect(parseWebViewMessage("not json")).toBeNull();
    expect(parseWebViewMessage(JSON.stringify({ type: "visible", session: 1 }))).toBeNull();
  });

  test("splits oversized blocks and reassembles them in order", () => {
    const batches = prepareTranslationBatches([{ id: "p1", text: "a ".repeat(20) }], 6, 12);
    expect(batches.length).toBeGreaterThan(1);
    const translations = new Map(
      batches.flat().map((part) => [part.id, `T${part.index}`]),
    );
    expect(reassembleTranslations(batches, translations)).toEqual([
      { id: "p1", text: batches.flat().map((part) => `T${part.index}`).join(" ") },
    ]);
  });

  test("accepts fenced JSON but requires every requested id", () => {
    const ids = new Set(["a::0", "b::0"]);
    expect(
      parseTranslationResponse(
        '```json\n{"translations":[{"id":"a::0","text":"A"},{"id":"b::0","text":"B"}]}\n```',
        ids,
      ),
    ).toHaveLength(2);
    expect(() =>
      parseTranslationResponse('[{"id":"a::0","text":"A"}]', ids),
    ).toThrow("every requested block");
  });
});
