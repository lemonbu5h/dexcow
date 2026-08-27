import { Database } from "bun:sqlite";
import { paths } from "./paths.ts";

interface CatalogTitleRow {
  thread_id: string;
  display_title: string | null;
}

export function loadDesktopThreadTitles(desktopDbPath = paths.desktopDb): Map<string, string> {
  let db: Database | null = null;
  try {
    db = new Database(desktopDbPath, { create: false, readonly: true });
    const rows = db.query(`
      SELECT thread_id, display_title
      FROM local_thread_catalog
      WHERE display_title IS NOT NULL AND trim(display_title) <> ''
      ORDER BY observation_sequence DESC
    `).all() as CatalogTitleRow[];

    const titles = new Map<string, string>();
    for (const row of rows) {
      if (!titles.has(row.thread_id)) titles.set(row.thread_id, row.display_title!.trim());
    }
    return titles;
  } catch (error) {
    if (isOptionalStoreError(error)) return new Map();
    throw error;
  } finally {
    db?.close();
  }
}

function isOptionalStoreError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("unable to open")
    || message.includes("ENOENT")
    || message.includes("no such table")
    || message.includes("no such column");
}
