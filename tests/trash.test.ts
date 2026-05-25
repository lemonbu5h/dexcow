import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emptyTrash, inspectTrash } from "../src/trash.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectTrash returns date buckets with counts and sizes", async () => {
  const trashRoot = await createTrashRoot();
  await writeFile(join(trashRoot, "2026-05-24", "one.jsonl"), "1234", "utf8");
  await writeFile(join(trashRoot, "2026-05-24", "two.jsonl"), "12", "utf8");
  await writeFile(join(trashRoot, "2026-05-25", "three.jsonl"), "123", "utf8");

  const summary = await inspectTrash(manageOptions(trashRoot));

  expect(summary.files).toBe(3);
  expect(summary.bytes).toBe(9);
  expect(summary.buckets.map((b) => b.name)).toEqual(["2026-05-25", "2026-05-24"]);
  expect(summary.buckets[0]?.files).toBe(1);
  expect(summary.buckets[1]?.files).toBe(2);
});

test("emptyTrash removes the trash root after reporting deleted files", async () => {
  const trashRoot = await createTrashRoot();
  await writeFile(join(trashRoot, "2026-05-25", "one.jsonl"), "1234", "utf8");

  const summary = await emptyTrash(manageOptions(trashRoot));

  expect(summary.files).toBe(1);
  expect(summary.bytes).toBe(4);
  expect(await exists(trashRoot)).toBe(false);
});

test("inspectTrash treats missing trash as empty", async () => {
  const trashRoot = await createTrashRoot();
  await rm(trashRoot, { recursive: true, force: true });

  const summary = await inspectTrash(manageOptions(trashRoot));

  expect(summary.files).toBe(0);
  expect(summary.bytes).toBe(0);
  expect(summary.buckets).toEqual([]);
});

test("trash management refuses paths outside the configured trash root", async () => {
  const trashRoot = await createTrashRoot();

  await expect(inspectTrash({ trashRoot: tmpdir(), expectedTrashRoot: trashRoot, codexRoot: trashRoot })).rejects.toThrow(
    "refusing to manage trash outside dexcow trash",
  );
});

async function createTrashRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dexcow-trash-"));
  tempDirs.push(root);
  const trashRoot = join(root, ".dexcow-trash");
  await mkdir(join(trashRoot, "2026-05-24"), { recursive: true });
  await mkdir(join(trashRoot, "2026-05-25"), { recursive: true });
  return trashRoot;
}

function manageOptions(trashRoot: string) {
  return {
    trashRoot,
    expectedTrashRoot: trashRoot,
    codexRoot: join(trashRoot, ".."),
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
