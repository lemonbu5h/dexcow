import { Database } from "bun:sqlite";
import { resolveStateDbPath } from "./codexStores.ts";
import { loadThreadNames, type ThreadNameMap } from "./sessionIndex.ts";

export interface Thread {
  id: string;
  title: string;
  rolloutPath: string;
  cwd: string;
  updatedAt: Date;
  archived: boolean;
}

interface ThreadRow {
  id: string;
  title: string;
  rollout_path: string;
  cwd: string;
  updated_at: number;
  archived: number;
}

const SELECT_ALL = `
  SELECT id, title, rollout_path, cwd, updated_at, archived
  FROM threads
  ORDER BY updated_at DESC, id DESC
`;

export function openDb(): Database {
  return new Database(resolveStateDbPath(), { create: false, readwrite: true });
}

export async function listThreads(db: Database): Promise<Thread[]> {
  // The database owns deletion state; session_index.jsonl only improves the title shown to users.
  const names = await loadThreadNames();
  return db.query(SELECT_ALL).all().map((r) => toThread(r, names));
}

function toThread(raw: unknown, names: ThreadNameMap): Thread {
  const r = raw as ThreadRow;
  return {
    id: r.id,
    title: resolveTitle(r.id, r.title, names),
    rolloutPath: r.rollout_path,
    cwd: r.cwd,
    updatedAt: new Date(r.updated_at * 1000),
    archived: r.archived === 1,
  };
}

function resolveTitle(id: string, rawTitle: string, names: ThreadNameMap): string {
  const named = names.get(id)?.trim();
  if (named !== undefined && named.length > 0) return named;
  return fallbackTitle(rawTitle);
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
