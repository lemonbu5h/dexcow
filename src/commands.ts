import * as p from "@clack/prompts";
import pc from "picocolors";
import { paths } from "./paths.ts";
import { purgeThreads, type PurgeResult } from "./purge.ts";
import { listThreads, openDb, type Thread } from "./threads.ts";
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

    const result = await purgeThreads(db, chosen, opts);
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
    const result = await purgeThreads(db, chosen, opts);
    console.log(summarize(result, opts));
  } finally {
    db.close();
  }
}

function summarize(r: PurgeResult, opts: DeleteOptions): string {
  const verb = opts.hard ? "purged" : "trashed";
  const main = `${verb} ${r.removed} session(s)`;
  const details = [
    `${r.stateRows} state row(s)`,
    `${r.logRows} log row(s)`,
    `${r.sessionIndexRows} index row(s)`,
  ];
  if (r.missingFiles > 0) details.push(`${r.missingFiles} rollout file(s) already missing`);
  const note = pc.dim(` (${details.join(", ")})`);
  return main + note;
}

function renderOptionLabel(t: Thread): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const tag = t.archived ? pc.yellow("archived") : pc.green("active  ");
  const title = truncate(t.title, 50);
  const cwd = pc.dim(truncate(shortenCwd(t.cwd), 40));
  return `${pc.dim(age)}  ${tag}  ${title}  ${cwd}`;
}
