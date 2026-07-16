import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  ASK_PRAGMAS_SQL,
  ASK_RESET_SQL,
  ASK_SCHEMA_SQL,
} from "./askSchema";

describe("Ask SQLite schema", () => {
  test("creates the persistent tables and cascades a thread delete", () => {
    const database = new Database(":memory:");
    database.exec(`${ASK_PRAGMAS_SQL}${ASK_SCHEMA_SQL}`);
    database
      .query(
        "INSERT INTO ask_threads(arxiv_id) VALUES (?)",
      )
      .run("1");
    database
      .query(
        "INSERT INTO ask_messages(id, arxiv_id, role, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("m", "1", "user", "hello", "complete", 1);
    database.query("DELETE FROM ask_threads WHERE arxiv_id = ?").run("1");
    expect(
      database.query("SELECT count(*) AS count FROM ask_messages").get() as {
        count: number;
      },
    ).toEqual({ count: 0 });
    database.close();
  });

  test("reset removes legacy tables before the compact schema is recreated", () => {
    const database = new Database(":memory:");
    database.exec(`${ASK_PRAGMAS_SQL}${ASK_SCHEMA_SQL}`);
    database.exec(`${ASK_RESET_SQL}${ASK_SCHEMA_SQL}`);
    const tables = database
      .query("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((table) => table.name)).not.toContain("ask_tool_events");
    expect(tables.map((table) => table.name)).not.toContain("paper_chunks");
    database.close();
  });
});
