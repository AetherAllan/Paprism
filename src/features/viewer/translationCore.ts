import { contentHash } from "@/features/library/offlineHtmlFormat";
import type { ProviderProfile } from "@/features/settings/providerCore";
import type { Paper } from "@/types/paper";

export type TranslationBlock = { id: string; text: string };
export type TranslationResult = { id: string; text: string };

export type WebViewMessage =
  | { type: "ready"; session: string; total: number }
  | { type: "visible"; session: string; blocks: TranslationBlock[] };

export type TranslationPart = {
  id: string;
  blockId: string;
  index: number;
  count: number;
  text: string;
};

export function parseWebViewMessage(value: string): WebViewMessage | null {
  try {
    const message = JSON.parse(value) as Record<string, unknown>;
    if (typeof message.session !== "string") return null;
    if (message.type === "ready" && typeof message.total === "number") {
      return { type: "ready", session: message.session, total: message.total };
    }
    if (message.type === "visible" && Array.isArray(message.blocks)) {
      const blocks = message.blocks.filter(
        (item): item is TranslationBlock =>
          !!item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          item.text.length > 0,
      );
      return { type: "visible", session: message.session, blocks };
    }
  } catch {
    // Web content is an untrusted boundary; malformed messages are ignored.
  }
  return null;
}

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
    const whitespace = window.lastIndexOf(" ");
    const cut = sentence > maxChars / 2 ? sentence + 1 : whitespace > 0 ? whitespace : maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function prepareTranslationBatches(
  blocks: TranslationBlock[],
  maxBlocks = 6,
  maxChars = 6000,
): TranslationPart[][] {
  const parts = blocks.flatMap((block) => {
    const texts = splitText(block.text, maxChars);
    return texts.map((text, index) => ({
      id: `${block.id}::${index}`,
      blockId: block.id,
      index,
      count: texts.length,
      text,
    }));
  });
  const batches: TranslationPart[][] = [];
  for (const part of parts) {
    const current = batches.at(-1);
    const chars = current?.reduce((sum, item) => sum + item.text.length, 0) ?? 0;
    if (!current || current.length >= maxBlocks || chars + part.text.length > maxChars) {
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
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as { translations?: unknown }).translations
      : null;
  if (!Array.isArray(rows)) throw new Error("Model response is not a translation array");
  const results = rows.filter(
    (row): row is TranslationResult =>
      !!row &&
      typeof row === "object" &&
      typeof row.id === "string" &&
      typeof row.text === "string" &&
      expectedIds.has(row.id),
  );
  if (results.length !== expectedIds.size) {
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
      .join(" ")
      .trim(),
  }));
}

export function translationCacheId(
  paper: Paper,
  profile: ProviderProfile,
  targetLang: string,
): string {
  return contentHash(
    JSON.stringify({
      version: 1,
      arxivId: paper.arxivId,
      updated: paper.updated,
      targetLang,
      kind: profile.kind,
      baseUrl: profile.baseUrl,
      model: profile.model,
    }),
  );
}

export function blockCacheKey(block: TranslationBlock): string {
  return `${block.id}:${contentHash(block.text)}`;
}
