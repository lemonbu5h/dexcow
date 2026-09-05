import { Database } from "bun:sqlite";
import { basename } from "node:path";

interface ProjectRootRow {
  path: string;
  name: string;
}

export function loadProjectTitles(db: Database): ReadonlyMap<string, string> {
  if (!tableExists(db, "projects") || !tableExists(db, "project_roots")) return new Map();

  const rows = db.query(`
    SELECT project_roots.path, projects.name
    FROM project_roots
    JOIN projects ON projects.id = project_roots.project_id
    ORDER BY projects.position, project_roots.position
  `).all() as ProjectRootRow[];
  const candidates = new Map<string, string[]>();
  for (const row of rows) {
    const names = candidates.get(row.path) ?? [];
    names.push(row.name);
    candidates.set(row.path, names);
  }

  return new Map([...candidates].flatMap(([path, names]) => {
    const name = names.length === 1 ? names[0] : names.find((candidate) => candidate === basename(path));
    return name ? [[path, name]] : [];
  }));
}

function tableExists(db: Database, table: string): boolean {
  return db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== null;
}
