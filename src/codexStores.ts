import { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { paths } from "./paths.ts";

const STATE_DB_PATTERN = /^state_(\d+)\.sqlite$/;
const LOGS_DB_PATTERN = /^logs_(\d+)\.sqlite$/;

const STATE_SCHEMA = {
  threads: ["id", "rollout_path", "cwd", "title", "updated_at", "archived"],
} as const;

const LOGS_SCHEMA = {
  logs: ["thread_id"],
} as const;

export function resolveStateDbPath(codexHome = paths.codexHome): string {
  const match = findSchemaDb(codexHome, STATE_DB_PATTERN, join(codexHome, "state_5.sqlite"), STATE_SCHEMA);
  if (match) return match;
  throw new Error(`Codex state database not found under ${codexHome}`);
}

export function describeStateDbPath(codexHome = paths.codexHome): string {
  try {
    return resolveStateDbPath(codexHome);
  } catch {
    return join(codexHome, "state_*.sqlite");
  }
}

export function resolveLogsDbPath(codexHome = paths.codexHome): string | null {
  return findSchemaDb(codexHome, LOGS_DB_PATTERN, join(codexHome, "logs_2.sqlite"), LOGS_SCHEMA);
}

function findSchemaDb(
  codexHome: string,
  pattern: RegExp,
  fallbackPath: string,
  schema: Record<string, readonly string[]>,
): string | null {
  for (const candidate of sqliteCandidates(codexHome, pattern, fallbackPath)) {
    if (matchesSchema(candidate, schema)) return candidate;
  }
  return null;
}

function sqliteCandidates(codexHome: string, pattern: RegExp, fallbackPath: string): string[] {
  const candidates = new Map<string, number>();

  try {
    for (const entry of readdirSync(codexHome, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const match = pattern.exec(entry.name);
      if (!match) continue;
      candidates.set(join(codexHome, entry.name), Number(match[1]));
    }
  } catch {
    return existsSync(fallbackPath) ? [fallbackPath] : [];
  }

  if (existsSync(fallbackPath) && !candidates.has(fallbackPath)) {
    candidates.set(fallbackPath, suffixVersion(fallbackPath, pattern));
  }

  return Array.from(candidates.entries())
    .filter(([path]) => isRegularFile(path))
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);
}

function matchesSchema(path: string, schema: Record<string, readonly string[]>): boolean {
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

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function suffixVersion(path: string, pattern: RegExp): number {
  const name = path.split("/").at(-1) ?? "";
  const match = pattern.exec(name);
  return match ? Number(match[1]) : -1;
}
