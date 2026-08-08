import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deleteRolloutFile } from "../src/rolloutFiles.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("deleteRolloutFile deletes files from active and archived rollout roots", async () => {
  const root = await mkdtemp(join(tmpdir(), "dexcow-rollout-"));
  tempDirs.push(root);
  const sessionsRoot = join(root, "sessions");
  const archivedRoot = join(root, "archived_sessions");
  const rolloutPath = join(sessionsRoot, "rollout.jsonl");
  const archivedPath = join(archivedRoot, "archived.jsonl");
  await mkdir(sessionsRoot);
  await mkdir(archivedRoot);
  await writeFile(rolloutPath, "{}\n", "utf8");
  await writeFile(archivedPath, "{}\n", "utf8");

  const rolloutRoots = [sessionsRoot, archivedRoot];
  expect(await deleteRolloutFile(rolloutPath, { rolloutRoots })).toBe(true);
  expect(await deleteRolloutFile(archivedPath, { rolloutRoots })).toBe(true);
  expect(await exists(rolloutPath)).toBe(false);
  expect(await exists(archivedPath)).toBe(false);
  expect(await deleteRolloutFile(rolloutPath, { rolloutRoots })).toBe(false);
});

test("deleteRolloutFile refuses files outside the sessions root", async () => {
  const root = await mkdtemp(join(tmpdir(), "dexcow-rollout-"));
  tempDirs.push(root);

  await expect(deleteRolloutFile(join(root, "outside.jsonl"), { rolloutRoots: [join(root, "sessions")] })).rejects.toThrow(
    "refusing to delete rollout outside Codex sessions",
  );
});

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
