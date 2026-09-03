import { Database } from "bun:sqlite";
import { openStateDb } from "./codexStores.ts";
import { loadDesktopThreadTitles } from "./desktopCatalog.ts";
import { loadThreadNames, type ThreadNameMap } from "./sessionIndex.ts";

export interface Thread {
  id: string;
  title: string;
  rolloutPath: string;
  cwd: string;
  gitOriginUrl: string;
  updatedAt: Date;
  archived: boolean;
}

interface ThreadRow {
  id: string;
  name: string | null;
  title: string;
  rollout_path: string;
  cwd: string;
  git_origin_url: string;
  updated_at: number;
  archived: number;
}

const SELECT_THREADS = `
  SELECT id, name, title, rollout_path, cwd, git_origin_url, updated_at, archived
  FROM threads
`;

const USER_FACING_THREAD = "COALESCE(thread_source, '') NOT IN ('subagent', 'guardian_review')";

export type ThreadScope = "active" | "archived" | "all";

export interface ListThreadOptions {
  scope?: ThreadScope;
  sessionIndexPath?: string;
  desktopDbPath?: string;
}

export function openDb(stateDbPath?: string): Database {
  return openStateDb(stateDbPath);
}

export async function listThreads(db: Database, opts: ListThreadOptions = {}): Promise<Thread[]> {
  // The state database owns deletion state; the other stores only improve user-facing titles.
  const desktopTitles = loadDesktopThreadTitles(opts.desktopDbPath);
  const names = await loadThreadNames(opts.sessionIndexPath);
  const where = scopeFilter(opts.scope);
  return db.query(`${SELECT_THREADS} ${where} ORDER BY updated_at DESC, id DESC`).all()
    .map((row) => toThread(row, desktopTitles, names));
}

function scopeFilter(scope: ThreadScope | undefined): string {
  if (scope === "archived") return `WHERE archived = 1 AND ${USER_FACING_THREAD}`;
  if (scope === "all") return `WHERE ${USER_FACING_THREAD}`;
  return `WHERE archived = 0 AND ${USER_FACING_THREAD}`;
}

function toThread(raw: unknown, desktopTitles: ReadonlyMap<string, string>, names: ThreadNameMap): Thread {
  const r = raw as ThreadRow;
  return {
    id: r.id,
    title: resolveTitle(r, desktopTitles, names),
    rolloutPath: r.rollout_path,
    cwd: r.cwd,
    gitOriginUrl: r.git_origin_url,
    updatedAt: new Date(r.updated_at * 1000),
    archived: r.archived === 1,
  };
}

function resolveTitle(row: ThreadRow, desktopTitles: ReadonlyMap<string, string>, names: ThreadNameMap): string {
  const candidates = [row.name, desktopTitles.get(row.id), names.get(row.id)];
  for (const candidate of candidates) {
    const title = candidate?.trim();
    if (title) return title;
  }
  return fallbackTitle(row.title);
}

function fallbackTitle(raw: string): string {
  // Codex titles can contain full markdown snippets; use the first readable line as a compact fallback.
  const firstLine = raw.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const stripped = stripMarkdownLinks(firstLine).replace(/\s+/g, " ").trim();
  return stripped.length === 0 ? "(untitled)" : stripped;
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}
