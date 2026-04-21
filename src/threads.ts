import { Database } from "bun:sqlite";
import { paths } from "./paths.ts";

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

const DELETE_THREAD = `DELETE FROM threads WHERE id = ?`;

export function openDb(): Database {
  return new Database(paths.stateDb, { create: false, readwrite: true });
}

export function listThreads(db: Database): Thread[] {
  return db.query(SELECT_ALL).all().map(toThread);
}

export function deleteThreadRow(db: Database, id: string): void {
  db.query(DELETE_THREAD).run(id);
}

function toThread(raw: unknown): Thread {
  const r = raw as ThreadRow;
  return {
    id: r.id,
    title: sanitizeTitle(r.title),
    rolloutPath: r.rollout_path,
    cwd: r.cwd,
    updatedAt: new Date(r.updated_at * 1000),
    archived: r.archived === 1,
  };
}

function sanitizeTitle(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return oneLine.length === 0 ? "(untitled)" : oneLine;
}
