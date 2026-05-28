import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveLogsDbPath, resolveStateDbPath } from "../src/codexStores.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveStateDbPath chooses the newest valid state schema", async () => {
  const root = await createCodexHome();
  createInvalidDb(join(root, "state_99.sqlite"));
  createStateDb(join(root, "state_5.sqlite"));
  createStateDb(join(root, "state_6.sqlite"));

  expect(resolveStateDbPath(root)).toBe(join(root, "state_6.sqlite"));
});

test("resolveStateDbPath ignores nested codex-dev databases", async () => {
  const root = await createCodexHome();
  await mkdir(join(root, "sqlite"), { recursive: true });
  createStateDb(join(root, "state_5.sqlite"));
  createAutomationDb(join(root, "sqlite", "codex-dev.db"));

  expect(resolveStateDbPath(root)).toBe(join(root, "state_5.sqlite"));
});

test("resolveStateDbPath throws when no state schema matches", async () => {
  const root = await createCodexHome();
  createInvalidDb(join(root, "state_5.sqlite"));

  expect(() => resolveStateDbPath(root)).toThrow("Codex state database not found");
});

test("resolveLogsDbPath returns newest logs schema or null", async () => {
  const root = await createCodexHome();
  createLogsDb(join(root, "logs_2.sqlite"));
  createLogsDb(join(root, "logs_3.sqlite"));

  expect(resolveLogsDbPath(root)).toBe(join(root, "logs_3.sqlite"));
  expect(resolveLogsDbPath(await createCodexHome())).toBeNull();
});

async function createCodexHome(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-codex-stores-"));
  tempDirs.push(root);
  return root;
}

function createStateDb(path: string): void {
  withDb(path, (db) => {
    db.run("CREATE TABLE threads (id TEXT, rollout_path TEXT, cwd TEXT, title TEXT, updated_at INTEGER, archived INTEGER)");
  });
}

function createLogsDb(path: string): void {
  withDb(path, (db) => {
    db.run("CREATE TABLE logs (thread_id TEXT)");
  });
}

function createAutomationDb(path: string): void {
  withDb(path, (db) => {
    db.run("CREATE TABLE automations (id TEXT PRIMARY KEY)");
    db.run("CREATE TABLE inbox_items (thread_id TEXT)");
  });
}

function createInvalidDb(path: string): void {
  withDb(path, (db) => {
    db.run("CREATE TABLE unrelated (id TEXT)");
  });
}

function withDb(path: string, fn: (db: Database) => void): void {
  const db = new Database(path, { create: true, readwrite: true });
  try {
    fn(db);
  } finally {
    db.close();
  }
}
