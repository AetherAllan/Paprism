export const ASK_DATABASE_VERSION = 4;

export const ASK_PRAGMAS_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

export const ASK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ask_threads (
  arxiv_id TEXT PRIMARY KEY NOT NULL,
  draft TEXT NOT NULL DEFAULT '',
  selection_json TEXT NOT NULL DEFAULT '',
  chat_offset REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ask_messages (
  id TEXT PRIMARY KEY NOT NULL,
  arxiv_id TEXT NOT NULL REFERENCES ask_threads(arxiv_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('complete', 'pending', 'streaming', 'interrupted', 'error')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ask_messages_thread_time
  ON ask_messages(arxiv_id, created_at, id);

CREATE TABLE IF NOT EXISTS ask_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL REFERENCES ask_messages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('selection', 'paper', 'web')),
  title TEXT NOT NULL,
  url TEXT,
  quote TEXT,
  block_id TEXT
);

CREATE TABLE IF NOT EXISTS paper_embeddings (
  arxiv_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  model_fingerprint TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  vector BLOB NOT NULL,
  PRIMARY KEY(arxiv_id, source_hash, model_fingerprint, chunk_id)
);

CREATE TABLE IF NOT EXISTS reading_states (
  arxiv_id TEXT PRIMARY KEY NOT NULL,
  feed_offset REAL NOT NULL DEFAULT 0,
  reader_block_id TEXT
);
`;

export const ASK_RESET_SQL = `
DROP TABLE IF EXISTS ask_tool_events;
DROP TABLE IF EXISTS paper_chunks;
DROP TABLE IF EXISTS ask_sources;
DROP TABLE IF EXISTS ask_messages;
DROP TABLE IF EXISTS ask_threads;
DROP TABLE IF EXISTS paper_embeddings;
DROP TABLE IF EXISTS reading_states;
`;
