import type { PaperDocument } from "@/features/viewer/paperDocument";
import type { Paper } from "@/types/paper";
import type { AskChunk, AskMessage, AskSelection } from "./askTypes";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
export const MAX_CONTEXT_CHARS = 48_000;

export function createAskId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildPaperChunks(document: PaperDocument): AskChunk[] {
  const chunks: AskChunk[] = [];
  let ordinal = 0;
  for (const block of document.blocks) {
    const text = block.plainText.trim();
    // Headings are already carried by each following chunk as sectionTitle.
    // Indexing them alone lets short title-only vectors crowd useful passages
    // out of the fixed top-four retrieval result.
    if (
      !text ||
      block.kind === "heading" ||
      block.kind === "figure" ||
      block.kind === "unsupported"
    ) {
      continue;
    }
    if (text.length <= CHUNK_SIZE) {
      chunks.push({
        id: block.id,
        blockId: block.id,
        ordinal: ordinal++,
        sectionTitle: block.sectionTitle,
        text,
      });
      continue;
    }
    let start = 0;
    let part = 0;
    while (start < text.length) {
      const end = Math.min(text.length, start + CHUNK_SIZE);
      chunks.push({
        id: `${block.id}:${part}`,
        blockId: block.id,
        ordinal: ordinal++,
        sectionTitle: block.sectionTitle,
        text: text.slice(start, end).trim(),
      });
      if (end === text.length) break;
      start = end - CHUNK_OVERLAP;
      part += 1;
    }
  }
  return chunks;
}

export function encodeVector(values: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(values).buffer);
}

export function decodeVector(blob: Uint8Array): Float32Array {
  const copy = blob.slice();
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || a.length !== b.length) return -1;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index]!;
    const bv = b[index]!;
    dot += av * bv;
    aa += av * av;
    bb += bv * bv;
  }
  return aa > 0 && bb > 0 ? dot / Math.sqrt(aa * bb) : -1;
}

export function rankChunks(
  query: Float32Array,
  candidates: { chunk: AskChunk; vector: Float32Array }[],
  limit = 4,
): AskChunk[] {
  return candidates
    .map(({ chunk, vector }) => ({
      chunk,
      score: cosineSimilarity(query, vector),
    }))
    .filter(({ score }) => Number.isFinite(score) && score > -1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}

type ContextInput = {
  paper: Paper;
  question: string;
  selection?: AskSelection | null;
  visibleChunk?: AskChunk | null;
  retrieved: AskChunk[];
  recentMessages: AskMessage[];
};

export function buildAskContext(input: ContextInput): string {
  const clip = (value: string, limit: number) =>
    value.length <= limit ? value : `${value.slice(0, limit)}\n[truncated]`;
  const recent = input.recentMessages
    .slice(-12)
    .filter((message) => message.content.trim())
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
  const essential = [
    `PAPER\nTitle: ${input.paper.title}\narXiv: ${input.paper.arxivId}\nAbstract: ${clip(input.paper.abstract, 8_000)}`,
    input.selection
      ? `USER SELECTION (${input.selection.sectionTitle ?? "unknown section"})\nDisplayed text: ${clip(input.selection.text, 7_000)}\nOriginal block: ${clip(input.selection.sourceText, 7_000)}`
      : input.visibleChunk
        ? `CURRENT READING POSITION\n${clip(input.visibleChunk.text, 8_000)}`
        : "",
    recent ? `RECENT CONVERSATION\n${clip(recent, 12_000)}` : "",
    `CURRENT QUESTION\n${clip(input.question, 8_000)}`,
  ].filter(Boolean);
  const separator = "\n\n---\n\n";
  const essentialText = essential.join(separator);
  const retrievalBudget = Math.max(
    0,
    MAX_CONTEXT_CHARS - essentialText.length - separator.length - 200,
  );
  const retrievedText = input.retrieved.length
    ? clip(
        `RETRIEVED PAPER PASSAGES\n${input.retrieved
          .map(
            (chunk, index) =>
              `[P${index + 1}] ${chunk.sectionTitle ?? "Paper"}\n${chunk.text}`,
          )
          .join("\n\n")}`,
        retrievalBudget,
      )
    : "";
  const sections = [
    essential[0],
    essential[1],
    retrievedText,
    ...essential.slice(2),
  ].filter(Boolean);
  return sections.join(separator).slice(0, MAX_CONTEXT_CHARS);
}

export function embeddingFingerprint(baseUrl: string, model: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}::${model.trim()}`;
}
