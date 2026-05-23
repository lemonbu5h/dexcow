import { mkdir, rename, unlink, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { paths } from "./paths.ts";

export interface TrashOptions {
  sessionsRoot?: string;
  trashRoot?: string;
}

export async function moveToTrash(rolloutPath: string, opts: TrashOptions = {}): Promise<string | null> {
  assertSessionRolloutPath(rolloutPath, opts.sessionsRoot ?? paths.sessions);
  if (!(await exists(rolloutPath))) return null;

  const stamp = new Date().toISOString().slice(0, 10);
  const bucket = join(opts.trashRoot ?? paths.trash, stamp);
  await mkdir(bucket, { recursive: true });

  const dest = join(bucket, basename(rolloutPath));
  await rename(rolloutPath, dest);
  return dest;
}

export async function hardDelete(rolloutPath: string, opts: TrashOptions = {}): Promise<boolean> {
  assertSessionRolloutPath(rolloutPath, opts.sessionsRoot ?? paths.sessions);
  if (!(await exists(rolloutPath))) return false;
  await unlink(rolloutPath);
  return true;
}

function assertSessionRolloutPath(rolloutPath: string, sessionsRootPath: string): void {
  // Rollout paths come from Codex state; constrain destructive operations to the session tree.
  const sessionsRoot = resolve(sessionsRootPath);
  const candidate = resolve(rolloutPath);
  const pathFromRoot = relative(sessionsRoot, candidate);
  const isInsideSessions = pathFromRoot !== "" && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
  if (!isInsideSessions) {
    throw new Error(`refusing to delete rollout outside Codex sessions: ${rolloutPath}`);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
