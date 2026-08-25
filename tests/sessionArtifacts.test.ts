import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertThreadsUnlocked, findLockedThreadIds, ThreadsLockedError } from "../src/sessionArtifacts.ts";

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

  expect(findLockedThreadIds(new Set(["thread-1", "thread-2"]), locksRoot)).toEqual(["thread-1"]);
  expect(() => assertThreadsUnlocked(new Set(["thread-1"]), locksRoot)).toThrow(ThreadsLockedError);

  try {
    assertThreadsUnlocked(new Set(["thread-1"]), locksRoot);
  } catch (error) {
    expect(error).toBeInstanceOf(ThreadsLockedError);
    expect((error as ThreadsLockedError).threadIds).toEqual(["thread-1"]);
  }
  expect(() => assertThreadsUnlocked(new Set(["thread-2"]), locksRoot)).not.toThrow();
});
