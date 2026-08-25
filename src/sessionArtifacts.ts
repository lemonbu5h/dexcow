import { readdir, unlink } from "node:fs/promises";
import { existsSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { paths } from "./paths.ts";

export class ThreadsLockedError extends Error {
  constructor(readonly threadIds: string[]) {
    super(`close active Codex session(s) before deleting: ${threadIds.join(", ")}`);
    this.name = "ThreadsLockedError";
  }
}

export function findLockedThreadIds(ids: Set<string>, locksRoot = paths.threadWriterLocks): string[] {
  return [...ids].filter((id) => existsSync(join(locksRoot, `${id}.lock`)));
}

export function assertThreadsUnlocked(ids: Set<string>, locksRoot = paths.threadWriterLocks): void {
  const locked = findLockedThreadIds(ids, locksRoot);
  if (locked.length > 0) {
    throw new ThreadsLockedError(locked);
  }
}

export async function deleteShellSnapshots(
  ids: Set<string>,
  snapshotsRoot = paths.shellSnapshots,
): Promise<number> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(snapshotsRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingPath(error)) return 0;
    throw error;
  }

  let deleted = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sh")) continue;
    const separator = entry.name.indexOf(".");
    if (separator < 1 || !ids.has(entry.name.slice(0, separator))) continue;
    await unlink(join(snapshotsRoot, entry.name));
    deleted++;
  }
  return deleted;
}

function isMissingPath(error: unknown): boolean {
  return (error as { code?: unknown }).code === "ENOENT";
}
