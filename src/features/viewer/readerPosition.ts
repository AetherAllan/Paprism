import type { ReadingState } from "@/features/ask/askTypes";
import type { PaperDocument } from "./paperDocument";

export type InitialReaderPosition = {
  blockIndex: number;
  blockId: string | null;
};

/**
 * A block id survives dynamic Markdown layout changes; a document-wide pixel
 * offset does not. Restore the semantic block and let native layout place it.
 */
export function resolveInitialReaderPosition(
  document: PaperDocument,
  state: ReadingState | null,
): InitialReaderPosition {
  if (!state?.readerBlockId) {
    return { blockIndex: 0, blockId: null };
  }

  const blockIndex = document.blocks.findIndex(
    (block) => block.id === state.readerBlockId,
  );
  if (blockIndex < 0) {
    return { blockIndex: 0, blockId: null };
  }
  return {
    blockIndex,
    blockId: state.readerBlockId,
  };
}
