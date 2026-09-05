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

test("listThreads prefers explicit Codex names", async () => {
  const fixture = await createFixture();
  const db = new Database(fixture.stateDbPath, { create: false, readwrite: true });
  try {
    const threads = await listThreads(db, {
      sessionIndexPath: fixture.sessionIndexPath,
      desktopDbPath: fixture.desktopDbPath,
    });

    expect(threads).toEqual([
      expect.objectContaining({ id: "thread-1", title: "Explicit name", archived: false }),
    ]);
  } finally {
    db.close();
  }
});

test("listThreads falls back to the Desktop catalog title", async () => {
  const fixture = await createFixture();
  const db = new Database(fixture.stateDbPath, { create: false, readwrite: true });
  try {
    const threads = await listThreads(db, {
      scope: "archived",
      sessionIndexPath: fixture.sessionIndexPath,
      desktopDbPath: fixture.desktopDbPath,
    });
    expect(threads).toEqual([
      expect.objectContaining({ id: "thread-2", title: "Desktop title", archived: true }),
    ]);
  } finally {
    db.close();
  }
});

test("listThreads falls back to a readable state title when optional title stores are unavailable", async () => {
  const fixture = await createFixture();
  const db = new Database(fixture.stateDbPath, { create: false, readwrite: true });
  try {
    db.query("UPDATE threads SET name = NULL WHERE id = ?").run("thread-1");
    const threads = await listThreads(db, {
      sessionIndexPath: join(fixture.stateDbPath, "missing-index.jsonl"),
      desktopDbPath: join(fixture.stateDbPath, "missing-desktop.db"),
    });

    expect(threads[0]?.title).toBe("Read this first");
  } finally {
    db.close();
  }
});

test("listThreads loads the Codex project title for a project root", async () => {
  const fixture = await createFixture();
  const db = new Database(fixture.stateDbPath, { create: false, readwrite: true });
  try {
    db.run("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL)");
    db.run("CREATE TABLE project_roots (project_id TEXT NOT NULL, position INTEGER NOT NULL, path TEXT NOT NULL)");
    db.query("INSERT INTO projects VALUES (?, ?, ?)").run("project-1", "AI-CVD FDA", 0);
    db.query("INSERT INTO project_roots VALUES (?, ?, ?)").run("project-1", 0, "/tmp/demo");
    db.query("UPDATE threads SET git_origin_url = NULL WHERE id = ?").run("thread-1");

    const threads = await listThreads(db, {
      sessionIndexPath: fixture.sessionIndexPath,
      desktopDbPath: fixture.desktopDbPath,
    });

    expect(threads[0]).toEqual(expect.objectContaining({ id: "thread-1", projectTitle: "AI-CVD FDA" }));
  } finally {
    db.close();
  }
});

test("listThreads hides internal Codex sessions in every scope", async () => {
  const fixture = await createFixture();
  const db = new Database(fixture.stateDbPath, { create: false, readwrite: true });
  try {
    const options = { sessionIndexPath: fixture.sessionIndexPath, desktopDbPath: fixture.desktopDbPath };
    const active = await listThreads(db, { ...options, scope: "active" });
    const archived = await listThreads(db, { ...options, scope: "archived" });
    const all = await listThreads(db, { ...options, scope: "all" });

    expect(active.map((thread) => thread.id)).toEqual(["thread-1"]);
    expect(archived.map((thread) => thread.id)).toEqual(["thread-2"]);
    expect(all.map((thread) => thread.id)).toEqual(["thread-2", "thread-1"]);
  } finally {
    db.close();
  }
});

test("openDb opens an existing state database", async () => {
  const fixture = await createFixture();
  const db = openDb(fixture.stateDbPath);
  try {
    expect(db.query("SELECT count(*) AS count FROM threads").get()).toEqual({ count: 6 });
  } finally {
    db.close();
  }
});

async function createFixture(): Promise<{ stateDbPath: string; sessionIndexPath: string; desktopDbPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-threads-"));
  tempDirs.push(root);
  const stateDbPath = join(root, "state_5.sqlite");
  const sessionIndexPath = join(root, "session_index.jsonl");
  const desktopDbPath = join(root, "codex-dev.db");
  const db = new Database(stateDbPath, { create: true, readwrite: true });
  try {
    db.run("CREATE TABLE threads (id TEXT PRIMARY KEY, name TEXT, rollout_path TEXT NOT NULL, cwd TEXT NOT NULL, git_origin_url TEXT, title TEXT NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL, thread_source TEXT)");
    const insert = db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    insert.run("thread-1", "Explicit name", "/tmp/one.jsonl", "/tmp/demo", "git@github.com:demo/repo.git", "[Read this first](https://example.com)\nMore detail", 1, 0, "cli");
    insert.run("thread-2", null, "/tmp/two.jsonl", "/tmp/demo", "git@github.com:demo/repo.git", "Ignored title", 2, 1, "cli");
    insert.run("subagent-active", null, "/tmp/subagent-active.jsonl", "/tmp/demo", "git@github.com:demo/repo.git", "[260] user:", 3, 0, "subagent");
    insert.run("subagent-archived", null, "/tmp/subagent-archived.jsonl", "/tmp/demo", "git@github.com:demo/repo.git", "Reviewer transcript", 4, 1, "subagent");
    insert.run("guardian-active", null, "/tmp/guardian-active.jsonl", "/tmp/demo", "git@github.com:demo/repo.git", "The following is the Codex agent history whose request action you are assessing.", 5, 0, "guardian_review");
    insert.run("guardian-archived", null, "/tmp/guardian-archived.jsonl", "/tmp/demo", "git@github.com:demo/repo.git", "", 6, 1, "guardian_review");
  } finally {
    db.close();
  }
  const desktopDb = new Database(desktopDbPath, { create: true, readwrite: true });
  try {
    desktopDb.run("CREATE TABLE local_thread_catalog (thread_id TEXT, display_title TEXT, observation_sequence INTEGER)");
    desktopDb.query("INSERT INTO local_thread_catalog VALUES (?, ?, ?)").run("thread-2", "Desktop title", 2);
    desktopDb.query("INSERT INTO local_thread_catalog VALUES (?, ?, ?)").run("thread-2", "Old Desktop title", 1);
  } finally {
    desktopDb.close();
  }
  await writeFile(
    sessionIndexPath,
    JSON.stringify({ id: "thread-2", thread_name: "Indexed title", updated_at: "2026-06-19T00:00:00Z" }) + "\n",
    "utf8",
  );
  return { stateDbPath, sessionIndexPath, desktopDbPath };
}
