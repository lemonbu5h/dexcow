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

test("purges current Codex session stores and files", async () => {
  const fixture = await createFixture();
  const stateDb = new Database(fixture.stateDbPath, { create: false, readwrite: true });

  try {
    const result = await purgeThreads(stateDb, [fixture.thread], {
      logsDbPath: fixture.logsDbPath,
      sessionIndexPath: fixture.sessionIndexPath,
      rolloutRoots: [fixture.sessionsRoot, fixture.archivedSessionsRoot],
      shellSnapshotsRoot: fixture.shellSnapshotsRoot,
      threadWriterLocksRoot: join(fixture.root, "thread-writer-locks"),
      desktopDbPath: fixture.desktopDbPath,
      historySnapshotsDbPath: fixture.historySnapshotsDbPath,
    });

    expect(result).toMatchObject({
      removed: 1,
      missingFiles: 0,
      deletedFiles: 1,
      stateRows: 3,
      logRows: 2,
      sessionIndexRows: 2,
      catalogRows: 1,
      timelineRows: 1,
      automationRunRows: 1,
      inboxRows: 1,
      historySnapshotRows: 1,
      shellSnapshots: 1,
    });

    expect(countRows(stateDb, "threads", "id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "thread_dynamic_tools", "thread_id = 'thread-1'")).toBe(0);
    expect(countRows(stateDb, "thread_spawn_edges", "parent_thread_id = 'thread-1' OR child_thread_id = 'thread-1'")).toBe(0);
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
    expect(await exists(join(fixture.shellSnapshotsRoot, "thread-1.123.sh"))).toBe(false);
    expect(await exists(join(fixture.shellSnapshotsRoot, "thread-2.123.sh"))).toBe(true);

    expect(countRowsAt(fixture.desktopDbPath, "local_thread_catalog", "thread_id = 'thread-1'")).toBe(0);
    expect(countRowsAt(fixture.desktopDbPath, "thread_timeline_ledger", "thread_id = 'thread-1'")).toBe(0);
    expect(countRowsAt(fixture.desktopDbPath, "automation_runs", "thread_id = 'thread-1'")).toBe(0);
    expect(countRowsAt(fixture.desktopDbPath, "inbox_items", "thread_id = 'thread-1'")).toBe(0);
    expect(countRowsAt(fixture.historySnapshotsDbPath, "app_server_history_snapshots", "thread_id = 'thread-1'")).toBe(0);
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
    stateDb.run("CREATE TABLE thread_dynamic_tools (thread_id TEXT)");
    stateDb.run("CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT)");
    stateDb.query("INSERT INTO threads VALUES (?)").run("thread-1");

    const result = await purgeThreads(stateDb, [thread("thread-1", rolloutPath, root)], {
      logsDbPath: join(root, "missing-logs.sqlite"),
      sessionIndexPath: join(root, "missing-session-index.jsonl"),
      rolloutRoots: [sessionsRoot, join(root, "archived_sessions")],
      shellSnapshotsRoot: join(root, "missing-shell-snapshots"),
      threadWriterLocksRoot: join(root, "missing-thread-writer-locks"),
      desktopDbPath: join(root, "missing-codex-dev.db"),
      historySnapshotsDbPath: join(root, "missing-history.db"),
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
  root: string;
  stateDbPath: string;
  logsDbPath: string;
  sessionIndexPath: string;
  sessionsRoot: string;
  archivedSessionsRoot: string;
  shellSnapshotsRoot: string;
  desktopDbPath: string;
  historySnapshotsDbPath: string;
  rolloutPath: string;
  thread: Thread;
}

async function createFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-purge-"));
  tempDirs.push(root);

  const sessionsRoot = join(root, "sessions");
  const archivedSessionsRoot = join(root, "archived_sessions");
  const shellSnapshotsRoot = join(root, "shell_snapshots");
  await mkdir(sessionsRoot, { recursive: true });
  await mkdir(archivedSessionsRoot, { recursive: true });
  await mkdir(shellSnapshotsRoot, { recursive: true });

  const rolloutPath = join(sessionsRoot, "rollout-thread-1.jsonl");
  await writeFile(rolloutPath, "{}\n", "utf8");

  const stateDbPath = join(root, "state_5.sqlite");
  const logsDbPath = join(root, "logs_2.sqlite");
  const sessionIndexPath = join(root, "session_index.jsonl");
  const desktopDbPath = join(root, "sqlite", "codex-dev.db");
  const historySnapshotsDbPath = join(root, "sqlite", "codex-history-snapshots-dev.db");
  await mkdir(join(root, "sqlite"), { recursive: true });

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

  createDesktopDb(desktopDbPath);
  createHistorySnapshotsDb(historySnapshotsDbPath);
  await writeFile(join(shellSnapshotsRoot, "thread-1.123.sh"), "snapshot", "utf8");
  await writeFile(join(shellSnapshotsRoot, "thread-2.123.sh"), "snapshot", "utf8");

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
    root,
    stateDbPath,
    logsDbPath,
    sessionIndexPath,
    sessionsRoot,
    archivedSessionsRoot,
    shellSnapshotsRoot,
    desktopDbPath,
    historySnapshotsDbPath,
    rolloutPath,
    thread: thread("thread-1", rolloutPath, root),
  };
}

function createStateSchema(db: Database): void {
  db.run("CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, cwd TEXT NOT NULL, git_origin_url TEXT NOT NULL, title TEXT NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL)");
  db.run("CREATE TABLE thread_dynamic_tools (thread_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, input_schema TEXT NOT NULL, PRIMARY KEY(thread_id, position))");
  db.run("CREATE TABLE thread_spawn_edges (parent_thread_id TEXT NOT NULL, child_thread_id TEXT NOT NULL PRIMARY KEY, status TEXT NOT NULL)");
}

function seedState(db: Database, rolloutPath: string): void {
  db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?)").run("thread-1", rolloutPath, "/tmp", "git@github.com:demo/repo.git", "Delete me", 1, 0);
  db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?)").run("thread-2", rolloutPath, "/tmp", "git@github.com:demo/repo.git", "Keep me", 2, 0);
  db.query("INSERT INTO thread_dynamic_tools VALUES (?, ?, ?, ?, ?)").run("thread-1", 0, "tool", "desc", "{}");
  db.query("INSERT INTO thread_spawn_edges VALUES (?, ?, ?)").run("thread-1", "child-1", "done");
}

function createDesktopDb(path: string): void {
  const db = new Database(path, { create: true, readwrite: true });
  try {
    db.run("CREATE TABLE local_thread_catalog (host_id TEXT, thread_id TEXT)");
    db.run("CREATE TABLE thread_timeline_ledger (host_id TEXT, thread_id TEXT, sequence INTEGER)");
    db.run("CREATE TABLE automation_runs (thread_id TEXT)");
    db.run("CREATE TABLE inbox_items (id TEXT, thread_id TEXT)");
    db.query("INSERT INTO local_thread_catalog VALUES (?, ?)").run("local", "thread-1");
    db.query("INSERT INTO local_thread_catalog VALUES (?, ?)").run("local", "thread-2");
    db.query("INSERT INTO thread_timeline_ledger VALUES (?, ?, ?)").run("local", "thread-1", 1);
    db.query("INSERT INTO automation_runs VALUES (?)").run("thread-1");
    db.query("INSERT INTO inbox_items VALUES (?, ?)").run("inbox-1", "thread-1");
  } finally {
    db.close();
  }
}

function createHistorySnapshotsDb(path: string): void {
  const db = new Database(path, { create: true, readwrite: true });
  try {
    db.run("CREATE TABLE app_server_history_snapshots (thread_id TEXT)");
    db.query("INSERT INTO app_server_history_snapshots VALUES (?)").run("thread-1");
  } finally {
    db.close();
  }
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
    gitOriginUrl: "git@github.com:demo/repo.git",
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    archived: false,
  };
}

function countRows(db: Database, table: string, where: string): number {
  const row = db.query(`SELECT count(*) AS count FROM ${table} WHERE ${where}`).get() as { count: number };
  return row.count;
}

function countRowsAt(path: string, table: string, where: string): number {
  const db = new Database(path, { create: false, readonly: true });
  try {
    return countRows(db, table, where);
  } finally {
    db.close();
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
