import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { loadProjectTitles } from "../src/projectCatalog.ts";

test("loadProjectTitles returns no titles when project metadata is unavailable", () => {
  const db = new Database(":memory:");
  try {
    expect(loadProjectTitles(db)).toEqual(new Map());
  } finally {
    db.close();
  }
});

test("loadProjectTitles resolves duplicate roots only when a title matches the directory", () => {
  const db = new Database(":memory:");
  try {
    db.run("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL)");
    db.run("CREATE TABLE project_roots (project_id TEXT NOT NULL, position INTEGER NOT NULL, path TEXT NOT NULL)");
    const insertProject = db.query("INSERT INTO projects VALUES (?, ?, ?)");
    const insertRoot = db.query("INSERT INTO project_roots VALUES (?, ?, ?)");

    insertProject.run("named", "AI-CVD FDA", 0);
    insertProject.run("matching", "demo", 1);
    insertProject.run("other", "Another project", 2);
    insertRoot.run("named", 0, "/tmp/named");
    insertRoot.run("matching", 0, "/tmp/demo");
    insertRoot.run("other", 0, "/tmp/demo");

    expect(loadProjectTitles(db)).toEqual(new Map([
      ["/tmp/named", "AI-CVD FDA"],
      ["/tmp/demo", "demo"],
    ]));
  } finally {
    db.close();
  }
});
