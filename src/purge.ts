import { Database } from "bun:sqlite";
import { resolveLogsDbPath } from "./codexStores.ts";
import { paths } from "./paths.ts";
import { removeThreadNames } from "./sessionIndex.ts";
import type { Thread } from "./threads.ts";
import { hardDelete, moveToTrash } from "./trash.ts";

export interface PurgeOptions {
  hard: boolean;
  logsDbPath?: string;
  sessionIndexPath?: string;
  sessionsRoot?: string;
  trashRoot?: string;
}

export interface PurgeResult {
  removed: number;
  missingFiles: number;
  trashedFiles: number;
  deletedFiles: number;
  stateRows: number;
  logRows: number;
  sessionIndexRows: number;
}

interface StateCleanupResult {
  rows: number;
}

const EMPTY_RESULT: PurgeResult = {
  removed: 0,
  missingFiles: 0,
  trashedFiles: 0,
  deletedFiles: 0,
  stateRows: 0,
  logRows: 0,
  sessionIndexRows: 0,
};

export async function purgeThreads(
  stateDb: Database,
  threads: Thread[],
  opts: PurgeOptions,
): Promise<PurgeResult> {
  if (threads.length === 0) return { ...EMPTY_RESULT };

  const result = { ...EMPTY_RESULT, removed: threads.length };
  const ids = new Set(threads.map((t) => t.id));

  for (const thread of threads) {
    const fileResult = opts.hard
      ? await hardDelete(thread.rolloutPath, { sessionsRoot: opts.sessionsRoot })
      : await moveToTrash(thread.rolloutPath, { sessionsRoot: opts.sessionsRoot, trashRoot: opts.trashRoot });
    if (fileResult === null || fileResult === false) {
      result.missingFiles++;
    } else if (opts.hard) {
      result.deletedFiles++;
    } else {
      result.trashedFiles++;
    }
  }

  result.stateRows = deleteStateRows(stateDb, ids).rows;
  result.logRows = deleteLogRows(ids, opts.logsDbPath ?? resolveLogsDbPath());
  result.sessionIndexRows = await removeThreadNames(ids, opts.sessionIndexPath ?? paths.sessionIndex);

  return result;
}

function deleteStateRows(db: Database, ids: Set<string>): StateCleanupResult {
  const cleanup = db.transaction((threadIds: string[]) => {
    let rows = 0;
    for (const id of threadIds) {
      rows += runDeleteIfTableExists(db, "thread_dynamic_tools", "DELETE FROM thread_dynamic_tools WHERE thread_id = ?", id);
      rows += runDeleteIfTableExists(db, "stage1_outputs", "DELETE FROM stage1_outputs WHERE thread_id = ?", id);
      rows += runDeleteIfTableExists(
        db,
        "thread_spawn_edges",
        "DELETE FROM thread_spawn_edges WHERE parent_thread_id = ? OR child_thread_id = ?",
        id,
        id,
      );
      rows += runUpdateIfColumnExists(
        db,
        "agent_job_items",
        "assigned_thread_id",
        "UPDATE agent_job_items SET assigned_thread_id = NULL WHERE assigned_thread_id = ?",
        id,
      );
      rows += runDeleteIfTableExists(db, "threads", "DELETE FROM threads WHERE id = ?", id);
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
      rows += runDeleteIfTableExists(db, "logs", "DELETE FROM logs WHERE thread_id = ?", id);
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

function runUpdate(db: Database, sql: string, ...params: string[]): number {
  return changes(db.query(sql).run(...params));
}

function runDeleteIfTableExists(db: Database, table: string, sql: string, ...params: string[]): number {
  if (!tableExists(db, table)) return 0;
  return runDelete(db, sql, ...params);
}

function runUpdateIfColumnExists(
  db: Database,
  table: string,
  column: string,
  sql: string,
  ...params: string[]
): number {
  if (!columnExists(db, table, column)) return 0;
  return runUpdate(db, sql, ...params);
}

function tableExists(db: Database, table: string): boolean {
  const row = db
    .query("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { ok: number } | null;
  return row !== null;
}

function columnExists(db: Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const rows = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function changes(result: unknown): number {
  const value = (result as { changes?: unknown }).changes;
  return typeof value === "number" ? value : 0;
}

function isMissingDb(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("unable to open") || msg.includes("ENOENT");
}
