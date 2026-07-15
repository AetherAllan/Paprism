export const PAPER_DOCUMENT_VERSION = 1;

export type ProtectedToken = {
  marker: string;
  markdown: string;
};

export type PaperAsset = {
  uri: string;
  alt: string;
  aspectRatio?: number;
};

export type PaperBlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "quote"
  | "equation"
  | "table"
  | "figure"
  | "code"
  | "unsupported";

export type PaperBlock = {
  id: string;
  anchorIds: string[];
  kind: PaperBlockKind;
  markdown: string;
  plainText: string;
  /** Markdown-like text sent to translation with formulas and URLs protected. */
  translationSource?: string;
  protectedTokens: ProtectedToken[];
  sectionTitle?: string;
  contextBefore?: string;
  assets?: PaperAsset[];
};

export type PaperDocument = {
  version: typeof PAPER_DOCUMENT_VERSION;
  arxivId: string;
  sourceUrl: string;
  sourceHash: string;
  blocks: PaperBlock[];
};

const BLOCK_KINDS = new Set<PaperBlockKind>([
  "heading",
  "paragraph",
  "list",
  "quote",
  "equation",
  "table",
  "figure",
  "code",
  "unsupported",
]);

export function isPaperDocument(value: unknown): value is PaperDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<PaperDocument>;
  return (
    document.version === PAPER_DOCUMENT_VERSION &&
    typeof document.arxivId === "string" &&
    typeof document.sourceUrl === "string" &&
    typeof document.sourceHash === "string" &&
    Array.isArray(document.blocks) &&
    document.blocks.every(isPaperBlock)
  );
}

function isPaperBlock(value: unknown): value is PaperBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Partial<PaperBlock>;
  return (
    typeof block.id === "string" &&
    BLOCK_KINDS.has(block.kind as PaperBlockKind) &&
    typeof block.markdown === "string" &&
    typeof block.plainText === "string" &&
    Array.isArray(block.anchorIds) &&
    block.anchorIds.every((anchor) => typeof anchor === "string") &&
    (block.translationSource === undefined ||
      typeof block.translationSource === "string") &&
    (block.sectionTitle === undefined ||
      typeof block.sectionTitle === "string") &&
    (block.contextBefore === undefined ||
      typeof block.contextBefore === "string") &&
    Array.isArray(block.protectedTokens) &&
    block.protectedTokens.every(
      (token) =>
        !!token &&
        typeof token === "object" &&
        typeof token.marker === "string" &&
        typeof token.markdown === "string",
    ) &&
    (block.assets === undefined ||
      (Array.isArray(block.assets) &&
        block.assets.every(
          (asset) =>
            !!asset &&
            typeof asset === "object" &&
            typeof asset.uri === "string" &&
            typeof asset.alt === "string" &&
            (asset.aspectRatio === undefined ||
              (typeof asset.aspectRatio === "number" && asset.aspectRatio > 0)),
        )))
  );
}

/**
 * Restore math and link targets after translation. Every marker must survive
 * exactly once; accepting a damaged response can silently change equations.
 */
export function restoreProtectedTokens(
  translated: string,
  tokens: ProtectedToken[],
): string {
  let output = translated;
  for (const token of tokens) {
    if (output.split(token.marker).length !== 2) {
      throw new Error(`Translation changed protected token ${token.marker}`);
    }
    output = output.replace(token.marker, token.markdown);
  }
  return output.trim();
}

export function translatableBlocks(document: PaperDocument): PaperBlock[] {
  return document.blocks.filter(
    (block) =>
      block.translationSource && block.translationSource.trim().length > 1,
  );
}
