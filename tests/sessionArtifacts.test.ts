import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertThreadsUnlocked } from "../src/sessionArtifacts.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("assertThreadsUnlocked refuses sessions with a current writer lock", async () => {
  const locksRoot = await mkdtemp(join(tmpdir(), "dexcow-locks-"));
  tempDirs.push(locksRoot);
  await writeFile(join(locksRoot, "thread-1.lock"), "", "utf8");

  expect(() => assertThreadsUnlocked(new Set(["thread-1"]), locksRoot)).toThrow(
    "close active Codex session(s) before deleting: thread-1",
  );
  expect(() => assertThreadsUnlocked(new Set(["thread-2"]), locksRoot)).not.toThrow();
});
