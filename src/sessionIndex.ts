import { readFile, writeFile } from "node:fs/promises";
import { paths } from "./paths.ts";

interface IndexEntry {
  id: string;
  thread_name: string;
  updated_at: string;
}

export type ThreadNameMap = Map<string, string>;

export async function loadThreadNames(): Promise<ThreadNameMap> {
  // The JSONL index may contain repeated names for a thread; keep the newest entry for display.
  const latest = new Map<string, IndexEntry>();
  const raw = await safeRead(paths.sessionIndex);
  if (raw === null) return new Map();

  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    const entry = parseEntry(line);
    if (entry === null) continue;
    const prev = latest.get(entry.id);
    if (prev === undefined || entry.updated_at > prev.updated_at) {
      latest.set(entry.id, entry);
    }
  }

  const names: ThreadNameMap = new Map();
  for (const [id, entry] of latest) names.set(id, entry.thread_name);
  return names;
}

export async function removeThreadNames(ids: Set<string>, indexPath = paths.sessionIndex): Promise<number> {
  const raw = await safeRead(indexPath);
  if (raw === null) return 0;

  const kept: string[] = [];
  let removed = 0;
  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    const entry = parseEntry(line);
    if (entry !== null && ids.has(entry.id)) {
      removed++;
      continue;
    }
    kept.push(line);
  }

  const next = kept.length === 0 ? "" : kept.join("\n") + "\n";
  await writeFile(indexPath, next, "utf8");
  return removed;
}

function parseEntry(line: string): IndexEntry | null {
  try {
    const obj = JSON.parse(line) as Partial<IndexEntry>;
    if (typeof obj.id !== "string") return null;
    if (typeof obj.thread_name !== "string") return null;
    if (typeof obj.updated_at !== "string") return null;
    return { id: obj.id, thread_name: obj.thread_name, updated_at: obj.updated_at };
  } catch {
    return null;
  }
}

async function safeRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
