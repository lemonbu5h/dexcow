import * as p from "@clack/prompts";
import pc from "picocolors";
import { paths } from "./paths.ts";
import { deleteThreadRow, listThreads, openDb, type Thread } from "./threads.ts";
import { hardDelete, moveToTrash } from "./trash.ts";
import { formatThreadLine, relativeTime, shortenCwd, truncate } from "./format.ts";

export interface DeleteOptions {
  hard: boolean;
}

export async function runInteractive(opts: DeleteOptions): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(" dexcow ")) + pc.dim(" cow eats Codex sessions"));

  const db = openDb();
  try {
    const threads = await listThreads(db);
    if (threads.length === 0) {
      p.note("No Codex sessions found.", "empty");
      p.outro("nothing to eat 🐄");
      return;
    }

    const picked = await p.multiselect<string>({
      message: `Pick sessions to ${opts.hard ? pc.red("PURGE") : "trash"} (space to toggle, enter to confirm)`,
      options: threads.map((t) => ({
        value: t.id,
        label: renderOptionLabel(t),
      })),
      required: false,
    });

    if (p.isCancel(picked) || picked.length === 0) {
      p.cancel("nothing selected");
      return;
    }

    const ids = new Set(picked);
    const chosen = threads.filter((t) => ids.has(t.id));
    const verb = opts.hard ? "permanently delete" : `move to ${pc.cyan(shortenCwd(paths.trash))}`;
    const confirmed = await p.confirm({
      message: `${verb} ${pc.bold(String(chosen.length))} session(s)?`,
      initialValue: false,
    });
    if (!confirmed || p.isCancel(confirmed)) {
      p.cancel("aborted");
      return;
    }

    const result = await deleteMany(db, chosen, opts);
    p.outro(summarize(result, opts));
  } finally {
    db.close();
  }
}

export async function runList(): Promise<void> {
  const db = openDb();
  try {
    const threads = await listThreads(db);
    if (threads.length === 0) {
      console.log("(no sessions)");
      return;
    }
    for (const t of threads) console.log(formatThreadLine(t));
  } finally {
    db.close();
  }
}

export async function runRemove(ids: string[], opts: DeleteOptions): Promise<void> {
  if (ids.length === 0) {
    console.error("usage: dexcow rm <id> [id...] [--hard]");
    process.exit(2);
  }
  const db = openDb();
  try {
    const threads = await listThreads(db);
    const byId = new Map(threads.map((t) => [t.id, t]));
    const chosen: Thread[] = [];
    for (const id of ids) {
      const t = byId.get(id);
      if (!t) {
        console.error(pc.yellow(`skip: ${id} not found`));
        continue;
      }
      chosen.push(t);
    }
    const result = await deleteMany(db, chosen, opts);
    console.log(summarize(result, opts));
  } finally {
    db.close();
  }
}

interface DeleteResult {
  removed: number;
  missingFiles: number;
}

async function deleteMany(
  db: ReturnType<typeof openDb>,
  threads: Thread[],
  opts: DeleteOptions,
): Promise<DeleteResult> {
  let removed = 0;
  let missingFiles = 0;
  for (const t of threads) {
    const movedOrGone = opts.hard
      ? await hardDelete(t.rolloutPath)
      : (await moveToTrash(t.rolloutPath)) !== null;
    if (!movedOrGone) missingFiles++;
    deleteThreadRow(db, t.id);
    removed++;
  }
  return { removed, missingFiles };
}

function summarize(r: DeleteResult, opts: DeleteOptions): string {
  const verb = opts.hard ? "purged" : "trashed";
  const main = `${verb} ${r.removed} session(s)`;
  const note = r.missingFiles > 0 ? pc.dim(` (${r.missingFiles} rollout file(s) already missing)`) : "";
  return main + note;
}

function renderOptionLabel(t: Thread): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const tag = t.archived ? pc.yellow("archived") : pc.green("active  ");
  const title = truncate(t.title, 50);
  const cwd = pc.dim(truncate(shortenCwd(t.cwd), 40));
  return `${pc.dim(age)}  ${tag}  ${title}  ${cwd}`;
}
