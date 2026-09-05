import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("locked deletion prints a friendly error without a stack trace", async () => {
  const codexHome = await createLockedSessionFixture();
  const { exitCode, stderr } = await runCli(codexHome, ["rm", "thread-1", "--yes"]);

  expect(exitCode).toBe(1);
  expect(stderr).toContain("Cannot delete 1 session; Codex is still using it.");
  expect(stderr).toContain("No changes were made.");
  expect(stderr).not.toContain(" at ");

  const db = new Database(join(codexHome, "state_5.sqlite"), { create: false, readonly: true });
  try {
    expect(db.query("SELECT id FROM threads WHERE id = ?").get("thread-1")).toEqual({ id: "thread-1" });
  } finally {
    db.close();
  }
});

test("list renders sessions without a Git origin in active and archived scopes", async () => {
  const codexHome = await createLockedSessionFixture();
  const db = new Database(join(codexHome, "state_5.sqlite"), { create: false, readwrite: true });
  try {
    db.run("UPDATE threads SET git_origin_url = NULL");
    for (const archived of [0, 1]) {
      db.query("UPDATE threads SET archived = ?").run(archived);
      const { exitCode, stdout, stderr } = await runCli(codexHome, archived ? ["ls", "--archived"] : ["ls"]);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("Total 1 session");
      expect(stdout).toContain("demo  1 session");
      expect(stdout).toContain("Locked session");
      expect(stdout).toContain(archived ? "archived" : "active");
    }
  } finally {
    db.close();
  }
});

test("missing state database is reported as not installed", async () => {
  const codexHome = await createCodexHome();
  const { exitCode, stderr } = await runCli(codexHome);

  expect(exitCode).toBe(1);
  expect(stderr).toContain("Codex state database not found:");
  expect(stderr).toContain("Is Codex installed?");
});

test("unavailable state database is not reported as missing", async () => {
  const codexHome = await createCodexHome();
  await mkdir(join(codexHome, "state_5.sqlite"));
  const { exitCode, stderr } = await runCli(codexHome);

  expect(exitCode).toBe(1);
  expect(stderr).toContain("Codex state database is temporarily unavailable:");
  expect(stderr).toContain("Wait a moment, then try again.");
  expect(stderr).not.toContain("Is Codex installed?");
  expect(stderr).not.toContain(" at ");
});

test("incompatible state database is reported as unsupported", async () => {
  const codexHome = await createCodexHome();
  const db = new Database(join(codexHome, "state_5.sqlite"), { create: true, readwrite: true });
  db.run("CREATE TABLE unrelated (id TEXT)");
  db.close();
  const { exitCode, stderr } = await runCli(codexHome);

  expect(exitCode).toBe(1);
  expect(stderr).toContain("This Codex storage format is not supported yet:");
  expect(stderr).toContain("Missing expected fields:");
  expect(stderr).not.toContain("Is Codex installed?");
});

async function runCli(codexHome: string, args: string[] = ["ls"]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const process = Bun.spawn(["bun", "run", "src/index.ts", ...args], {
    cwd: join(import.meta.dir, ".."),
    env: { ...Bun.env, CODEX_HOME: codexHome, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

async function createCodexHome(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-cli-"));
  tempDirs.push(root);
  return root;
}

async function createLockedSessionFixture(): Promise<string> {
  const root = await createCodexHome();
  const locksRoot = join(root, "thread-writer-locks");
  await mkdir(locksRoot);
  await writeFile(join(locksRoot, "thread-1.lock"), "", "utf8");

  const db = new Database(join(root, "state_5.sqlite"), { create: true, readwrite: true });
  try {
    db.run("CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, cwd TEXT NOT NULL, git_origin_url TEXT, title TEXT NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL, thread_source TEXT, name TEXT)");
    db.query("INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "thread-1",
      join(root, "sessions", "thread-1.jsonl"),
      "/tmp/demo",
      "git@github.com:demo/repo.git",
      "Locked session",
      1,
      0,
      "cli",
      null,
    );
  } finally {
    db.close();
  }
  return root;
}
