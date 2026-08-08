import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { paths } from "./paths.ts";

const STATE_SCHEMA = {
  threads: ["id", "rollout_path", "cwd", "git_origin_url", "title", "updated_at", "archived"],
} as const;

const LOGS_SCHEMA = {
  logs: ["thread_id"],
} as const;

export function resolveStateDbPath(codexHome = paths.codexHome): string {
  const stateDbPath = join(codexHome, "state_5.sqlite");
  if (matchesSchema(stateDbPath, STATE_SCHEMA)) return stateDbPath;
  throw new Error(`current Codex state database not found: ${stateDbPath}`);
}

export function describeStateDbPath(codexHome = paths.codexHome): string {
  try {
    return resolveStateDbPath(codexHome);
  } catch {
    return join(codexHome, "state_5.sqlite");
  }
}

export function resolveLogsDbPath(codexHome = paths.codexHome): string | null {
  const logsDbPath = join(codexHome, "logs_2.sqlite");
  return matchesSchema(logsDbPath, LOGS_SCHEMA) ? logsDbPath : null;
}

function matchesSchema(path: string, schema: Record<string, readonly string[]>): boolean {
  if (!existsSync(path)) return false;
  let db: Database | null = null;
  try {
    db = new Database(path, { create: false, readonly: true });
    return Object.entries(schema).every(([table, columns]) => tableHasColumns(db!, table, columns));
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function tableHasColumns(db: Database, table: string, columns: readonly string[]): boolean {
  if (!tableExists(db, table)) return false;
  const existing = new Set((db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
  return columns.every((column) => existing.has(column));
}

function tableExists(db: Database, table: string): boolean {
  const row = db
    .query("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { ok: number } | null;
  return row !== null;
}
