import { Database } from "bun:sqlite";
import { resolveLogsDbPath } from "./codexStores.ts";
import { cleanDesktopStores } from "./desktopStores.ts";
import { paths } from "./paths.ts";
import { deleteRolloutFile } from "./rolloutFiles.ts";
import { assertThreadsUnlocked, deleteShellSnapshots } from "./sessionArtifacts.ts";
import { removeThreadNames } from "./sessionIndex.ts";
import type { Thread } from "./threads.ts";

export interface PurgeOptions {
  logsDbPath?: string;
  sessionIndexPath?: string;
  rolloutRoots?: string[];
  shellSnapshotsRoot?: string;
  threadWriterLocksRoot?: string;
  desktopDbPath?: string;
  historySnapshotsDbPath?: string;
}

export interface PurgeResult {
  removed: number;
  missingFiles: number;
  deletedFiles: number;
  stateRows: number;
  logRows: number;
  sessionIndexRows: number;
  catalogRows: number;
  timelineRows: number;
  automationRunRows: number;
  inboxRows: number;
  historySnapshotRows: number;
  shellSnapshots: number;
}

interface StateCleanupResult {
  rows: number;
}

const EMPTY_RESULT: PurgeResult = {
  removed: 0,
  missingFiles: 0,
  deletedFiles: 0,
  stateRows: 0,
  logRows: 0,
  sessionIndexRows: 0,
  catalogRows: 0,
  timelineRows: 0,
  automationRunRows: 0,
  inboxRows: 0,
  historySnapshotRows: 0,
  shellSnapshots: 0,
};

export async function purgeThreads(
  stateDb: Database,
  threads: Thread[],
  opts: PurgeOptions,
): Promise<PurgeResult> {
  if (threads.length === 0) return { ...EMPTY_RESULT };

  const result = { ...EMPTY_RESULT, removed: threads.length };
  const ids = new Set(threads.map((t) => t.id));
  assertThreadsUnlocked(ids, opts.threadWriterLocksRoot);

  for (const thread of threads) {
    const deleted = await deleteRolloutFile(thread.rolloutPath, { rolloutRoots: opts.rolloutRoots });
    if (!deleted) {
      result.missingFiles++;
    } else {
      result.deletedFiles++;
    }
  }

  result.shellSnapshots = await deleteShellSnapshots(ids, opts.shellSnapshotsRoot);

  const desktop = cleanDesktopStores(ids, {
    desktopDbPath: opts.desktopDbPath,
    historySnapshotsDbPath: opts.historySnapshotsDbPath,
  });
  Object.assign(result, desktop);

  result.stateRows = deleteStateRows(stateDb, ids).rows;
  result.logRows = deleteLogRows(ids, opts.logsDbPath ?? resolveLogsDbPath());
  result.sessionIndexRows = await removeThreadNames(ids, opts.sessionIndexPath ?? paths.sessionIndex);

  return result;
}

function deleteStateRows(db: Database, ids: Set<string>): StateCleanupResult {
  const cleanup = db.transaction((threadIds: string[]) => {
    let rows = 0;
    for (const id of threadIds) {
      rows += runDelete(db, "DELETE FROM thread_dynamic_tools WHERE thread_id = ?", id);
      rows += runDelete(
        db,
        "DELETE FROM thread_spawn_edges WHERE parent_thread_id = ? OR child_thread_id = ?",
        id,
        id,
      );
      rows += runDelete(db, "DELETE FROM threads WHERE id = ?", id);
    }
    return { rows };
  });

  return cleanup([...ids]) as StateCleanupResult;
}

function deleteLogRows(ids: Set<string>, logsDbPath: string | null): number {
  if (!logsDbPath) return 0;
  let db: Database | null = null;
  try {
    db = new Database(logsDbPath, { create: false, readwrite: true });
    let rows = 0;
    for (const id of ids) {
      rows += runDelete(db, "DELETE FROM logs WHERE thread_id = ?", id);
    }
    return rows;
  } catch (err) {
    if (isMissingDb(err)) return 0;
    throw err;
  } finally {
    db?.close();
  }
}

function runDelete(db: Database, sql: string, ...params: string[]): number {
  return changes(db.query(sql).run(...params));
}

function changes(result: unknown): number {
  const value = (result as { changes?: unknown }).changes;
  return typeof value === "number" ? value : 0;
}

function isMissingDb(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("unable to open") || msg.includes("ENOENT");
}
