import { Database } from "bun:sqlite";
import { paths } from "./paths.ts";

export interface DesktopCleanupOptions {
  desktopDbPath?: string;
  historySnapshotsDbPath?: string;
}

export interface DesktopCleanupResult {
  catalogRows: number;
  timelineRows: number;
  automationRunRows: number;
  inboxRows: number;
  historySnapshotRows: number;
}

const EMPTY_RESULT: DesktopCleanupResult = {
  catalogRows: 0,
  timelineRows: 0,
  automationRunRows: 0,
  inboxRows: 0,
  historySnapshotRows: 0,
};

export function cleanDesktopStores(
  ids: Set<string>,
  opts: DesktopCleanupOptions = {},
): DesktopCleanupResult {
  const result = { ...EMPTY_RESULT };
  if (ids.size === 0) return result;

  withOptionalDb(opts.desktopDbPath ?? paths.desktopDb, (db) => {
    const clean = db.transaction((threadIds: string[]) => {
      for (const id of threadIds) {
        result.timelineRows += deleteRows(db, "DELETE FROM thread_timeline_ledger WHERE thread_id = ?", id);
        result.catalogRows += deleteRows(db, "DELETE FROM local_thread_catalog WHERE thread_id = ?", id);
        result.automationRunRows += deleteRows(db, "DELETE FROM automation_runs WHERE thread_id = ?", id);
        result.inboxRows += deleteRows(db, "DELETE FROM inbox_items WHERE thread_id = ?", id);
      }
    });
    clean([...ids]);
  });

  withOptionalDb(opts.historySnapshotsDbPath ?? paths.historySnapshotsDb, (db) => {
    for (const id of ids) {
      result.historySnapshotRows += deleteRows(db, "DELETE FROM app_server_history_snapshots WHERE thread_id = ?", id);
    }
  });

  return result;
}

function withOptionalDb(path: string, callback: (db: Database) => void): void {
  let db: Database | null = null;
  try {
    db = new Database(path, { create: false, readwrite: true });
    callback(db);
  } catch (error) {
    if (!isMissingDb(error)) throw error;
  } finally {
    db?.close();
  }
}

function deleteRows(db: Database, sql: string, id: string): number {
  const result = db.query(sql).run(id) as { changes?: unknown };
  return typeof result.changes === "number" ? result.changes : 0;
}

function isMissingDb(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("unable to open") || message.includes("ENOENT");
}
