import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import type { Paper } from "@/types/paper";
import {
  ASK_DATABASE_VERSION,
  ASK_PRAGMAS_SQL,
  ASK_RESET_SQL,
  ASK_SCHEMA_SQL,
} from "./askSchema";
import type {
  AskMessage,
  AskMessageStatus,
  AskSource,
  AskThread,
  ReadingState,
} from "./askTypes";

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function openAskDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync("paprism.db");
  await database.execAsync(ASK_PRAGMAS_SQL);
  const version = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = version?.user_version ?? 0;
  if (currentVersion < ASK_DATABASE_VERSION) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (currentVersion > 0) await transaction.execAsync(ASK_RESET_SQL);
      await transaction.execAsync(ASK_SCHEMA_SQL);
      await transaction.execAsync(
        `PRAGMA user_version = ${ASK_DATABASE_VERSION}`,
      );
    });
  }
  // A process death can strand an assistant placeholder. It is recoverable,
  // but must not look like a request that is still running after restart.
  await database.runAsync(
    "UPDATE ask_messages SET status = 'interrupted' WHERE status IN ('pending', 'streaming')",
  );
  return database;
}

export function getAskDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openAskDatabase();
  return databasePromise;
}

export async function ensureAskThread(paper: Paper): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    "INSERT OR IGNORE INTO ask_threads(arxiv_id) VALUES (?)",
    paper.arxivId,
  );
}

export async function loadAskThread(
  arxivId: string,
): Promise<AskThread | null> {
  const database = await getAskDatabase();
  const row = await database.getFirstAsync<{
    arxiv_id: string;
    draft: string;
    selection_json: string;
    chat_offset: number;
  }>("SELECT * FROM ask_threads WHERE arxiv_id = ?", arxivId);
  return row
    ? {
        arxivId: row.arxiv_id,
        draft: row.draft,
        selection: parseSelection(row.selection_json),
        chatOffset: row.chat_offset,
      }
    : null;
}

export async function loadAskMessages(arxivId: string): Promise<AskMessage[]> {
  const database = await getAskDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    arxiv_id: string;
    role: "user" | "assistant";
    content: string;
    status: AskMessageStatus;
    created_at: number;
  }>(
    "SELECT * FROM ask_messages WHERE arxiv_id = ? ORDER BY created_at, id",
    arxivId,
  );
  return rows.map((row) => ({
    id: row.id,
    arxivId: row.arxiv_id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function insertAskMessage(message: AskMessage): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    `INSERT INTO ask_messages(id, arxiv_id, role, content, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    message.id,
    message.arxivId,
    message.role,
    message.content,
    message.status,
    message.createdAt,
  );
}

export async function updateAskMessage(
  id: string,
  content: string,
  status: AskMessageStatus,
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    "UPDATE ask_messages SET content = ?, status = ? WHERE id = ?",
    content,
    status,
    id,
  );
}

export async function resetAskAssistantMessage(id: string): Promise<void> {
  const database = await getAskDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "DELETE FROM ask_sources WHERE message_id = ?",
      id,
    );
    await transaction.runAsync(
      "UPDATE ask_messages SET content = '', status = 'pending' WHERE id = ?",
      id,
    );
  });
}

export async function insertAskSource(
  source: Omit<AskSource, "id">,
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    `INSERT INTO ask_sources(message_id, kind, title, url, quote, block_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    source.messageId,
    source.kind,
    source.title,
    source.url ?? null,
    source.quote ?? null,
    source.blockId ?? null,
  );
}

export async function loadAskSources(arxivId: string): Promise<AskSource[]> {
  const database = await getAskDatabase();
  const rows = await database.getAllAsync<{
    id: number;
    message_id: string;
    kind: AskSource["kind"];
    title: string;
    url: string | null;
    quote: string | null;
    block_id: string | null;
  }>(
    `SELECT source.* FROM ask_sources source
     JOIN ask_messages message ON message.id = source.message_id
     WHERE message.arxiv_id = ? ORDER BY source.id`,
    arxivId,
  );
  return rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    kind: row.kind,
    title: row.title,
    url: row.url ?? undefined,
    quote: row.quote ?? undefined,
    blockId: row.block_id ?? undefined,
  }));
}

export async function saveAskThreadUi(
  arxivId: string,
  draft: string,
  chatOffset: number,
  selection: AskThread["selection"],
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    "UPDATE ask_threads SET draft = ?, chat_offset = ?, selection_json = ? WHERE arxiv_id = ?",
    draft,
    chatOffset,
    selection ? JSON.stringify(selection) : "",
    arxivId,
  );
}

function parseSelection(value: string): AskThread["selection"] {
  if (!value) return null;
  try {
    const selection = JSON.parse(value) as Partial<
      NonNullable<AskThread["selection"]>
    >;
    return typeof selection.arxivId === "string" &&
      typeof selection.blockId === "string" &&
      typeof selection.text === "string" &&
      typeof selection.sourceText === "string" &&
      (selection.language === "source" || selection.language === "translation")
      ? (selection as NonNullable<AskThread["selection"]>)
      : null;
  } catch {
    return null;
  }
}

export async function deleteStalePaperEmbeddings(
  arxivId: string,
  sourceHash: string,
  fingerprint: string,
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    `DELETE FROM paper_embeddings
     WHERE arxiv_id = ? AND (source_hash <> ? OR model_fingerprint <> ?)`,
    arxivId,
    sourceHash,
    fingerprint,
  );
}

export async function savePaperEmbedding(
  arxivId: string,
  sourceHash: string,
  fingerprint: string,
  chunkId: string,
  vector: Uint8Array,
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO paper_embeddings
     (arxiv_id, source_hash, model_fingerprint, chunk_id, vector)
     VALUES (?, ?, ?, ?, ?)`,
    arxivId,
    sourceHash,
    fingerprint,
    chunkId,
    vector,
  );
}

export async function loadPaperEmbeddings(
  arxivId: string,
  sourceHash: string,
  fingerprint: string,
): Promise<{ chunkId: string; vector: Uint8Array }[]> {
  const database = await getAskDatabase();
  const rows = await database.getAllAsync<{
    chunk_id: string;
    vector: Uint8Array;
  }>(
    `SELECT chunk_id, vector FROM paper_embeddings
     WHERE arxiv_id = ? AND source_hash = ? AND model_fingerprint = ?`,
    arxivId,
    sourceHash,
    fingerprint,
  );
  return rows.map((row) => ({ chunkId: row.chunk_id, vector: row.vector }));
}

export async function loadReadingState(
  arxivId: string,
): Promise<ReadingState | null> {
  const database = await getAskDatabase();
  const row = await database.getFirstAsync<{
    arxiv_id: string;
    feed_offset: number;
    reader_block_id: string | null;
  }>("SELECT * FROM reading_states WHERE arxiv_id = ?", arxivId);
  return row
    ? {
        arxivId: row.arxiv_id,
        feedOffset: row.feed_offset,
        readerBlockId: row.reader_block_id,
      }
    : null;
}

export async function saveFeedReadingOffset(
  arxivId: string,
  feedOffset: number,
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    `INSERT INTO reading_states(arxiv_id, feed_offset)
     VALUES (?, ?)
     ON CONFLICT(arxiv_id) DO UPDATE SET
       feed_offset = excluded.feed_offset`,
    arxivId,
    feedOffset,
  );
}

export async function saveReaderPosition(
  arxivId: string,
  readerBlockId: string | null,
): Promise<void> {
  const database = await getAskDatabase();
  await database.runAsync(
    `INSERT INTO reading_states(arxiv_id, reader_block_id)
     VALUES (?, ?)
     ON CONFLICT(arxiv_id) DO UPDATE SET
       reader_block_id = excluded.reader_block_id`,
    arxivId,
    readerBlockId,
  );
}

export async function clearPaperAskData(arxivId: string): Promise<void> {
  const database = await getAskDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "DELETE FROM ask_threads WHERE arxiv_id = ?",
      arxivId,
    );
    await transaction.runAsync(
      "DELETE FROM paper_embeddings WHERE arxiv_id = ?",
      arxivId,
    );
  });
}

export async function clearAllAskData(): Promise<void> {
  const database = await getAskDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM ask_threads;
      DELETE FROM paper_embeddings;
    `);
  });
}
