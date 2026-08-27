import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { paths } from "./paths.ts";

const STATE_SCHEMA = {
  threads: ["id", "rollout_path", "cwd", "git_origin_url", "title", "updated_at", "archived", "thread_source", "name"],
} as const;

const LOGS_SCHEMA = {
  logs: ["thread_id"],
} as const;

const STORE_BUSY_TIMEOUT_MS = 750;
const SCHEMA_CHECK_ATTEMPTS = 3;
const SCHEMA_RETRY_DELAY_MS = 100;

type StoreSchema = Record<string, readonly string[]>;

type SchemaInspection =
  | { status: "match" }
  | { status: "missing" }
  | { status: "mismatch"; missingColumns: string[] }
  | { status: "unavailable"; cause: unknown };

export class CodexStoreSchemaError extends Error {
  constructor(readonly path: string, readonly missingColumns: string[]) {
    super(`unsupported Codex database schema at ${path}; missing: ${missingColumns.join(", ")}`);
    this.name = "CodexStoreSchemaError";
  }
}

export class CodexStoreNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`current Codex state database not found: ${path}`);
    this.name = "CodexStoreNotFoundError";
  }
}

export class CodexStoreUnavailableError extends Error {
  constructor(readonly path: string, options?: ErrorOptions) {
    super(`Codex database is temporarily unavailable: ${path}`, options);
    this.name = "CodexStoreUnavailableError";
  }
}

export function resolveStateDbPath(codexHome = paths.codexHome): string {
  const stateDbPath = join(codexHome, "state_5.sqlite");
  const inspection = inspectSchemaWithRetry(stateDbPath, STATE_SCHEMA);
  if (inspection.status === "match") return stateDbPath;
  if (inspection.status === "missing") {
    throw new CodexStoreNotFoundError(stateDbPath);
  }
  if (inspection.status === "mismatch") {
    throw new CodexStoreSchemaError(stateDbPath, inspection.missingColumns);
  }
  throw new CodexStoreUnavailableError(stateDbPath, { cause: inspection.cause });
}

export function describeStateDbPath(codexHome = paths.codexHome): string {
  return join(codexHome, "state_5.sqlite");
}

export function openStateDb(stateDbPath = resolveStateDbPath()): Database {
  let db: Database | null = null;
  try {
    db = new Database(stateDbPath, { create: false, readwrite: true });
    db.run(`PRAGMA busy_timeout = ${STORE_BUSY_TIMEOUT_MS}`);
    return db;
  } catch (cause) {
    db?.close();
    throw new CodexStoreUnavailableError(stateDbPath, { cause });
  }
}

export function resolveLogsDbPath(codexHome = paths.codexHome): string | null {
  const logsDbPath = join(codexHome, "logs_2.sqlite");
  const inspection = inspectSchemaWithRetry(logsDbPath, LOGS_SCHEMA);
  return inspection.status === "match" ? logsDbPath : null;
}

function inspectSchemaWithRetry(path: string, schema: StoreSchema): SchemaInspection {
  for (let attempt = 1; attempt <= SCHEMA_CHECK_ATTEMPTS; attempt++) {
    const inspection = inspectSchema(path, schema);
    if (inspection.status !== "unavailable" || attempt === SCHEMA_CHECK_ATTEMPTS) return inspection;
    Bun.sleepSync(SCHEMA_RETRY_DELAY_MS);
  }
  throw new Error("unreachable schema retry state");
}

function inspectSchema(path: string, schema: StoreSchema): SchemaInspection {
  if (!existsSync(path)) return { status: "missing" };
  let db: Database | null = null;
  try {
    db = new Database(path, { create: false, readonly: true });
    db.run(`PRAGMA busy_timeout = ${STORE_BUSY_TIMEOUT_MS}`);
    const missingColumns = Object.entries(schema).flatMap(([table, columns]) => findMissingColumns(db!, table, columns));
    return missingColumns.length === 0 ? { status: "match" } : { status: "mismatch", missingColumns };
  } catch (cause) {
    return { status: "unavailable", cause };
  } finally {
    db?.close();
  }
}

function findMissingColumns(db: Database, table: string, columns: readonly string[]): string[] {
  if (!tableExists(db, table)) return columns.map((column) => `${table}.${column}`);
  const existing = new Set((db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
  return columns.filter((column) => !existing.has(column)).map((column) => `${table}.${column}`);
}

function tableExists(db: Database, table: string): boolean {
  const row = db
    .query("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { ok: number } | null;
  return row !== null;
}
