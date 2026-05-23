import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { purgeThreads } from "../src/purge.ts";
import type { Thread } from "../src/threads.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("purges thread records, logs, session index entries, and trashes rollout files", async () => {
  const fixture = await createFixture();
  const stateDb = new Database(fixture.stateDbPath, { create: false, readwrite: true });

  try {
    const result = await purgeThreads(stateDb, [fixture.thread], {
      hard: false,
      logsDbPath: fixture.logsDbPath,
      sessionIndexPath: fixture.sessionIndexPath,
      sessionsRoot: fixture.sessionsRoot,
      trashRoot: fixture.trashRoot,
    });

    expect(result).toMatchObject({
      removed: 1,
      missingFiles: 0,
      trashedFiles: 1,
      deletedFiles: 0,
      stateRows: 5,
      logRows: 2,
      sessionIndexRows: 2,
    });

    expect(countRows(stateDb, "threads", "id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "thread_dynamic_tools", "thread_id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "stage1_outputs", "thread_id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "thread_spawn_edges", "parent_thread_id = 'thread-1' OR child_thread_id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "agent_job_items", "assigned_thread_id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "threads", "id = 'thread-2'")).toBe(1);

    const logsDb = new Database(fixture.logsDbPath, { create: false, readwrite: true });
    try {
      expect(countRows(logsDb, "logs", "thread_id = 'thread-1'")).toBe(0);
      expect(countRows(logsDb, "logs", "thread_id = 'thread-2'")).toBe(1);
    } finally {
      logsDb.close();
    }

    const index = await readFile(fixture.sessionIndexPath, "utf8");
    expect(index).not.toContain("thread-1");
    expect(index).toContain("thread-2");
    expect(await exists(fixture.rolloutPath)).toBe(false);
    expect(await exists(join(fixture.trashRoot, today(), "rollout-thread-1.jsonl"))).toBe(true);
  } finally {
    stateDb.close();
  }
});

test("hard purge deletes rollout files without using trash", async () => {
  const fixture = await createFixture();
  const stateDb = new Database(fixture.stateDbPath, { create: false, readwrite: true });

  try {
    const result = await purgeThreads(stateDb, [fixture.thread], {
      hard: true,
      logsDbPath: fixture.logsDbPath,
      sessionIndexPath: fixture.sessionIndexPath,
      sessionsRoot: fixture.sessionsRoot,
      trashRoot: fixture.trashRoot,
    });

    expect(result.trashedFiles).toBe(0);
    expect(result.deletedFiles).toBe(1);
    expect(await exists(fixture.rolloutPath)).toBe(false);
    expect(await exists(join(fixture.trashRoot, today(), "rollout-thread-1.jsonl"))).toBe(false);
  } finally {
    stateDb.close();
  }
});

test("purge tolerates missing optional Codex stores", async () => {
  const root = await mkdtemp(join(tmpdir(), "dexcow-purge-minimal-"));
  tempDirs.push(root);

  const sessionsRoot = join(root, "sessions");
  const rolloutPath = join(sessionsRoot, "rollout-thread-1.jsonl");
  const stateDbPath = join(root, "state_5.sqlite");
  await mkdir(sessionsRoot, { recursive: true });
  await writeFile(rolloutPath, "{}\n", "utf8");

  const stateDb = new Database(stateDbPath, { create: true, readwrite: true });
  try {
    stateDb.run("CREATE TABLE threads (id TEXT PRIMARY KEY)");
    stateDb.query("INSERT INTO threads VALUES (?)").run("thread-1");

    const result = await purgeThreads(stateDb, [thread("thread-1", rolloutPath, root)], {
      hard: true,
      logsDbPath: join(root, "missing-logs.sqlite"),
      sessionIndexPath: join(root, "missing-session-index.jsonl"),
      sessionsRoot,
    });

    expect(result).toMatchObject({
      removed: 1,
      stateRows: 1,
      logRows: 0,
      sessionIndexRows: 0,
      deletedFiles: 1,
    });
    expect(countRows(stateDb, "threads", "id = 'thread-1'")).toBe(0);
  } finally {
    stateDb.close();
  }
});

interface Fixture {
  stateDbPath: string;
  logsDbPath: string;
  sessionIndexPath: string;
  sessionsRoot: string;
  trashRoot: string;
  rolloutPath: string;
  thread: Thread;
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-purge-"));
  tempDirs.push(root);

  const sessionsRoot = join(root, "sessions");
  const trashRoot = join(root, ".dexcow-trash");
  await mkdir(sessionsRoot, { recursive: true });

  const rolloutPath = join(sessionsRoot, "rollout-thread-1.jsonl");
  await writeFile(rolloutPath, "{}\n", "utf8");

  const stateDbPath = join(root, "state_5.sqlite");
  const logsDbPath = join(root, "logs_2.sqlite");
  const sessionIndexPath = join(root, "session_index.jsonl");

  const stateDb = new Database(stateDbPath, { create: true, readwrite: true });
  try {
    createStateSchema(stateDb);
    seedState(stateDb, rolloutPath);
  } finally {
    stateDb.close();
  }

  const logsDb = new Database(logsDbPath, { create: true, readwrite: true });
  try {
    createLogsSchema(logsDb);
    seedLogs(logsDb);
  } finally {
    logsDb.close();
  }

  await writeFile(
    sessionIndexPath,
    [
      JSON.stringify({ id: "thread-1", thread_name: "Old title", updated_at: "2026-01-01T00:00:00Z" }),
      JSON.stringify({ id: "thread-1", thread_name: "New title", updated_at: "2026-01-02T00:00:00Z" }),
      JSON.stringify({ id: "thread-2", thread_name: "Keep title", updated_at: "2026-01-03T00:00:00Z" }),
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    stateDbPath,
    logsDbPath,
    sessionIndexPath,
    sessionsRoot,
    trashRoot,
    rolloutPath,
    thread: thread("thread-1", rolloutPath, root),
  };
}

function createStateSchema(db: Database): void {
  db.run("CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, cwd TEXT NOT NULL, title TEXT NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL)");
  db.run("CREATE TABLE thread_dynamic_tools (thread_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, input_schema TEXT NOT NULL, PRIMARY KEY(thread_id, position))");
  db.run("CREATE TABLE stage1_outputs (thread_id TEXT PRIMARY KEY, source_updated_at INTEGER NOT NULL, raw_memory TEXT NOT NULL, rollout_summary TEXT NOT NULL, generated_at INTEGER NOT NULL)");
  db.run("CREATE TABLE thread_spawn_edges (parent_thread_id TEXT NOT NULL, child_thread_id TEXT NOT NULL PRIMARY KEY, status TEXT NOT NULL)");
  db.run("CREATE TABLE agent_job_items (job_id TEXT NOT NULL, item_id TEXT NOT NULL, assigned_thread_id TEXT, PRIMARY KEY(job_id, item_id))");
}

function seedState(db: Database, rolloutPath: string): void {
  db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?)").run("thread-1", rolloutPath, "/tmp", "Delete me", 1, 0);
  db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?)").run("thread-2", rolloutPath, "/tmp", "Keep me", 2, 0);
  db.query("INSERT INTO thread_dynamic_tools VALUES (?, ?, ?, ?, ?)").run("thread-1", 0, "tool", "desc", "{}");
  db.query("INSERT INTO stage1_outputs VALUES (?, ?, ?, ?, ?)").run("thread-1", 1, "raw", "summary", 1);
  db.query("INSERT INTO thread_spawn_edges VALUES (?, ?, ?)").run("thread-1", "child-1", "done");
  db.query("INSERT INTO agent_job_items VALUES (?, ?, ?)").run("job-1", "item-1", "thread-1");
}

function createLogsSchema(db: Database): void {
  db.run("CREATE TABLE logs (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id TEXT)");
}

function seedLogs(db: Database): void {
  db.query("INSERT INTO logs (thread_id) VALUES (?)").run("thread-1");
  db.query("INSERT INTO logs (thread_id) VALUES (?)").run("thread-1");
  db.query("INSERT INTO logs (thread_id) VALUES (?)").run("thread-2");
}

function thread(id: string, rolloutPath: string, cwd: string): Thread {
  return {
    id,
    title: "Delete me",
    rolloutPath,
    cwd,
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    archived: false,
  };
}

function countRows(db: Database, table: string, where: string): number {
  const row = db.query(`SELECT count(*) AS count FROM ${table} WHERE ${where}`).get() as { count: number };
  return row.count;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
