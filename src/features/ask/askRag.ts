import type { PaperDocument } from "@/features/viewer/paperDocument";
import {
  loadPaperEmbeddings,
  deleteStalePaperEmbeddings,
  savePaperEmbedding,
} from "./askDatabase";
import {
  buildPaperChunks,
  decodeVector,
  embeddingFingerprint,
  encodeVector,
  rankChunks,
} from "./askCore";
import { requestEmbeddings } from "./askClient";
import type { AskChunk, EmbeddingProfile } from "./askTypes";

export async function retrievePaperChunks({
  document,
  question,
  profile,
  apiKey,
  signal,
}: {
  document: PaperDocument;
  question: string;
  profile: EmbeddingProfile;
  apiKey: string;
  signal: AbortSignal;
}): Promise<AskChunk[]> {
  const chunks = buildPaperChunks(document);
  const fingerprint = embeddingFingerprint(profile.baseUrl, profile.model);
  await deleteStalePaperEmbeddings(
    document.arxivId,
    document.sourceHash,
    fingerprint,
  );
  let stored = await loadPaperEmbeddings(
    document.arxivId,
    document.sourceHash,
    fingerprint,
  );
  if (stored.length !== chunks.length) {
    // Batch conservatively: compatible endpoints often impose an input-count
    // limit even when the aggregate token count is small.
    for (let start = 0; start < chunks.length; start += 24) {
      const batch = chunks.slice(start, start + 24);
      const vectors = await requestEmbeddings(
        profile,
        apiKey,
        batch.map((chunk) => chunk.text),
        signal,
      );
      for (let index = 0; index < batch.length; index += 1) {
        const chunk = batch[index]!;
        const vector = vectors[index]!;
        await savePaperEmbedding(
          document.arxivId,
          document.sourceHash,
          fingerprint,
          chunk.id,
          encodeVector(vector),
        );
      }
    }
    stored = await loadPaperEmbeddings(
      document.arxivId,
      document.sourceHash,
      fingerprint,
    );
  }
  const [query] = await requestEmbeddings(profile, apiKey, [question], signal);
  const vectors = new Map(
    stored.map((row) => [row.chunkId, decodeVector(row.vector)]),
  );
  return rankChunks(
    new Float32Array(query!),
    chunks.flatMap((chunk) => {
      const vector = vectors.get(chunk.id);
      return vector ? [{ chunk, vector }] : [];
    }),
  );
}
