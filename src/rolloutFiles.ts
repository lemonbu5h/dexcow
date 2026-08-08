import { stat, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { paths } from "./paths.ts";

export interface RolloutFileOptions {
  rolloutRoots?: string[];
}

export async function deleteRolloutFile(
  rolloutPath: string,
  opts: RolloutFileOptions = {},
): Promise<boolean> {
  assertSessionRolloutPath(rolloutPath, opts.rolloutRoots ?? [paths.sessions, paths.archivedSessions]);
  if (!(await exists(rolloutPath))) return false;
  await unlink(rolloutPath);
  return true;
}

function assertSessionRolloutPath(rolloutPath: string, rolloutRootPaths: string[]): void {
  // Rollout paths come from Codex state; constrain deletion to current active and archived stores.
  const candidate = resolve(rolloutPath);
  const isInsideRolloutStore = rolloutRootPaths.some((rootPath) => {
    const pathFromRoot = relative(resolve(rootPath), candidate);
    return pathFromRoot !== "" && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
  });
  if (!isInsideRolloutStore) {
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
