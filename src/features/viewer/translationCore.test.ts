import { describe, expect, test } from "bun:test";
import {
  parseTranslationResponse,
  prepareTranslationBatches,
  reassembleTranslations,
} from "./translationCore";

describe("translation protocol", () => {
  test("splits oversized blocks and reassembles them in order", () => {
    const batches = prepareTranslationBatches(
      [{ id: "p1", text: "a ".repeat(20) }],
      6,
      12,
    );
    expect(batches.length).toBeGreaterThan(1);
    const translations = new Map(
      batches.flat().map((part) => [part.id, `T${part.index}`]),
    );
    expect(reassembleTranslations(batches, translations)).toEqual([
      {
        id: "p1",
        text: batches
          .flat()
          .map((part) => `T${part.index}`)
          .join("\n"),
      },
    ]);
  });

  test("splits a large Markdown table only between rows", () => {
    const table = [
      "| Name | Description |",
      "| --- | --- |",
      ...Array.from(
        { length: 8 },
        (_, index) => `| row ${index} | ${"word ".repeat(8)} |`,
      ),
    ].join("\n");
    const parts = prepareTranslationBatches(
      [{ id: "table", text: table }],
      6,
      90,
    ).flat();
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => !part.text.startsWith("word"))).toBe(true);
  });

  test("keeps section context together without repeating the whole paper", () => {
    const batches = prepareTranslationBatches([
      {
        id: "a",
        text: "first",
        context: { paperTitle: "Paper", sectionTitle: "Methods" },
      },
      {
        id: "b",
        text: "second",
        context: {
          paperTitle: "Paper",
          sectionTitle: "Methods",
          previousText: "first",
        },
      },
      {
        id: "c",
        text: "third",
        context: { paperTitle: "Paper", sectionTitle: "Results" },
      },
    ]);
    expect(batches.map((batch) => batch.map((part) => part.blockId))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
    expect(batches[0]?.[1]?.context?.previousText).toBe("first");
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
    expect(() =>
      parseTranslationResponse(
        '[{"id":"a::0","text":"A"},{"id":"a::0","text":"again"}]',
        ids,
      ),
    ).toThrow("every requested block");
  });
});
