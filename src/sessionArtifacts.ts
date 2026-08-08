import { readdir, unlink } from "node:fs/promises";
import { existsSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { paths } from "./paths.ts";

export function assertThreadsUnlocked(ids: Set<string>, locksRoot = paths.threadWriterLocks): void {
  const locked = [...ids].filter((id) => existsSync(join(locksRoot, `${id}.lock`)));
  if (locked.length > 0) {
    throw new Error(`close active Codex session(s) before deleting: ${locked.join(", ")}`);
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
