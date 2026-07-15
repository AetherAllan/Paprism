import { contentHash } from "@/lib/contentHash";
import type { ProviderProfile } from "@/features/settings/providerCore";
import type { Paper } from "@/types/paper";

export type TranslationContext = {
  paperTitle: string;
  sectionTitle?: string;
  previousText?: string;
};

export type TranslationBlock = {
  id: string;
  text: string;
  context?: TranslationContext;
};
export type TranslationResult = { id: string; text: string };

export type TranslationPart = {
  id: string;
  blockId: string;
  index: number;
  count: number;
  text: string;
  context?: TranslationContext;
};

function splitText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars + 1);
    const sentence = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("。"),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );
    const newline = window.lastIndexOf("\n");
    const whitespace = window.lastIndexOf(" ");
    // Prefer a row/list boundary. Splitting a large Markdown table in the
    // middle of a cell makes both model output and final rendering unstable.
    const cut =
      newline > maxChars / 2
        ? newline
        : sentence > maxChars / 2
          ? sentence + 1
          : whitespace > 0
            ? whitespace
            : maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function prepareTranslationBatches(
  blocks: TranslationBlock[],
  maxBlocks = 6,
  maxChars = 4500,
): TranslationPart[][] {
  const parts = blocks.flatMap((block) => {
    const texts = splitText(block.text, maxChars);
    return texts.map((text, index) => ({
      id: `${block.id}::${index}`,
      blockId: block.id,
      index,
      count: texts.length,
      text,
      context: block.context
        ? {
            ...block.context,
            previousText:
              index > 0
                ? texts[index - 1]?.slice(-600)
                : block.context.previousText,
          }
        : undefined,
    }));
  });
  const batches: TranslationPart[][] = [];
  for (const part of parts) {
    const current = batches.at(-1);
    const chars =
      current?.reduce((sum, item) => sum + item.text.length, 0) ?? 0;
    const currentSection = current?.[0]?.context?.sectionTitle ?? "";
    const nextSection = part.context?.sectionTitle ?? "";
    if (
      !current ||
      current.length >= maxBlocks ||
      chars + part.text.length > maxChars ||
      currentSection !== nextSection
    ) {
      batches.push([part]);
    } else {
      current.push(part);
    }
  }
  return batches;
}

export function parseTranslationResponse(
  content: string,
  expectedIds: Set<string>,
): TranslationResult[] {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as { translations?: unknown }).translations
      : null;
  if (!Array.isArray(rows))
    throw new Error("Model response is not a translation array");
  const results = rows.filter(
    (row): row is TranslationResult =>
      !!row &&
      typeof row === "object" &&
      typeof row.id === "string" &&
      typeof row.text === "string" &&
      expectedIds.has(row.id),
  );
  const uniqueIds = new Set(results.map((result) => result.id));
  if (
    results.length !== expectedIds.size ||
    uniqueIds.size !== expectedIds.size
  ) {
    throw new Error("Model response did not include every requested block");
  }
  return results;
}

export function reassembleTranslations(
  batches: TranslationPart[][],
  translatedParts: Map<string, string>,
): TranslationResult[] {
  const grouped = new Map<string, TranslationPart[]>();
  for (const part of batches.flat()) {
    grouped.set(part.blockId, [...(grouped.get(part.blockId) ?? []), part]);
  }
  return [...grouped].map(([id, parts]) => ({
    id,
    text: parts
      .sort((a, b) => a.index - b.index)
      .map((part) => translatedParts.get(part.id) ?? "")
      // A soft Markdown line break reads as a space for prose while preserving
      // row and list boundaries for structured blocks.
      .join("\n")
      .trim(),
  }));
}

export function translationCacheId(
  paper: Paper,
  profile: ProviderProfile,
  targetLang: string,
  sourceHash = "",
): string {
  return contentHash(
    JSON.stringify({
      version: 2,
      arxivId: paper.arxivId,
      updated: paper.updated,
      sourceHash,
      targetLang,
      kind: profile.kind,
      baseUrl: profile.baseUrl,
      model: profile.model,
    }),
  );
}

export function blockCacheKey(block: TranslationBlock): string {
  return `${block.id}:${contentHash(
    JSON.stringify({ text: block.text, context: block.context }),
  )}`;
}
