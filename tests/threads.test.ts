import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listThreads, openDb } from "../src/threads.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("listThreads resolves indexed names and readable fallback titles", async () => {
  const fixture = await createFixture();
  const db = new Database(fixture.stateDbPath, { create: false, readwrite: true });
  try {
    const threads = await listThreads(db, fixture.sessionIndexPath);

    expect(threads).toEqual([
      expect.objectContaining({ id: "thread-2", title: "Indexed title", archived: true }),
      expect.objectContaining({ id: "thread-1", title: "Read this first", archived: false }),
    ]);
  } finally {
    db.close();
  }
});

test("openDb opens an existing state database", async () => {
  const fixture = await createFixture();
  const db = openDb(fixture.stateDbPath);
  try {
    expect(db.query("SELECT count(*) AS count FROM threads").get()).toEqual({ count: 2 });
  } finally {
    db.close();
  }
});

async function createFixture(): Promise<{ stateDbPath: string; sessionIndexPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-threads-"));
  tempDirs.push(root);
  const stateDbPath = join(root, "state_5.sqlite");
  const sessionIndexPath = join(root, "session_index.jsonl");
  const db = new Database(stateDbPath, { create: true, readwrite: true });
  try {
    db.run("CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, cwd TEXT NOT NULL, title TEXT NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL)");
    db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?)").run("thread-1", "/tmp/one.jsonl", "/tmp/demo", "[Read this first](https://example.com)\nMore detail", 1, 0);
    db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?)").run("thread-2", "/tmp/two.jsonl", "/tmp/demo", "Ignored title", 2, 1);
  } finally {
    db.close();
  }
  await writeFile(
    sessionIndexPath,
    JSON.stringify({ id: "thread-2", thread_name: "Indexed title", updated_at: "2026-06-19T00:00:00Z" }) + "\n",
    "utf8",
  );
  return { stateDbPath, sessionIndexPath };
}
