import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadThreadNames, removeThreadNames } from "../src/sessionIndex.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadThreadNames keeps the newest valid title per thread", async () => {
  const indexPath = await writeIndex([
    { id: "thread-1", thread_name: "Old title", updated_at: "2026-01-01T00:00:00Z" },
    "{bad json",
    { id: "thread-1", thread_name: "New title", updated_at: "2026-01-02T00:00:00Z" },
    { id: "thread-2", thread_name: "Keep title", updated_at: "2026-01-03T00:00:00Z" },
    { id: "thread-3", thread_name: 12, updated_at: "2026-01-04T00:00:00Z" },
  ]);

  const names = await loadThreadNames(indexPath);

  expect(names.get("thread-1")).toBe("New title");
  expect(names.get("thread-2")).toBe("Keep title");
  expect(names.has("thread-3")).toBe(false);
});

test("loadThreadNames treats a missing index as empty", async () => {
  const root = await createTempDir();

  expect(await loadThreadNames(join(root, "missing.jsonl"))).toEqual(new Map());
});

test("removeThreadNames removes matching entries and preserves invalid lines", async () => {
  const indexPath = await writeIndex([
    { id: "thread-1", thread_name: "Remove me", updated_at: "2026-01-01T00:00:00Z" },
    "{bad json",
    { id: "thread-2", thread_name: "Keep me", updated_at: "2026-01-02T00:00:00Z" },
  ]);

  const removed = await removeThreadNames(new Set(["thread-1"]), indexPath);

  expect(removed).toBe(1);
  const next = await readFile(indexPath, "utf8");
  expect(next).toContain("{bad json");
  expect(next).toContain("thread-2");
  expect(next).not.toContain("thread-1");
});

test("removeThreadNames returns zero for a missing index", async () => {
  const root = await createTempDir();

  expect(await removeThreadNames(new Set(["thread-1"]), join(root, "missing.jsonl"))).toBe(0);
});

async function writeIndex(lines: Array<object | string>): Promise<string> {
  const root = await createTempDir();
  const indexPath = join(root, "session_index.jsonl");
  await writeFile(indexPath, lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n") + "\n");
  return indexPath;
}

async function createTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-session-index-"));
  tempDirs.push(root);
  return root;
}
