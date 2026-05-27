import * as p from "@clack/prompts";
import pc from "picocolors";
import { paths } from "./paths.ts";
import { purgeThreads, type PurgeResult } from "./purge.ts";
import { listThreads, openDb, type Thread } from "./threads.ts";
import { emptyTrash, inspectTrash, type TrashSummary } from "./trash.ts";
import {
  formatThreadGroups,
  projectName,
  relativeTime,
  shortenCwd,
  truncate,
} from "./format.ts";

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
      message: `Pick sessions to ${opts.hard ? pc.red("PURGE") : "trash"} (space toggles, enter continues, q exits)`,
      options: threads.map((thread) => ({
        value: thread.id,
        label: renderOptionLabel(thread),
      })),
      required: true,
    });

    if (p.isCancel(picked)) {
      exitCleanly("exited; no changes made");
      return;
    }

    const ids = new Set(picked);
    const chosen = threads.filter((t) => ids.has(t.id));
    const verb = opts.hard ? "permanently delete" : `move to ${pc.cyan(shortenCwd(paths.trash))}`;
    p.note(chosen.map(renderChosenLine).join("\n"), "selected");
    const confirmed = await p.confirm({
      message: `${verb} ${pc.bold(String(chosen.length))} session(s)?`,
      active: opts.hard ? "Yes, purge" : "Yes, trash",
      inactive: "No, keep",
      initialValue: false,
    });
    if (!confirmed || p.isCancel(confirmed)) {
      exitCleanly("kept selected session(s); no changes made");
      return;
    }

    const result = await purgeThreads(db, chosen, opts);
    p.outro(summarize(result, opts) + trashLocation(result, opts) + restartNote());
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
    console.log(formatThreadGroups(threads));
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
    console.log(summarize(result, opts) + trashLocation(result, opts) + restartNote());
  } finally {
    db.close();
  }
}

export async function runTrash(args: string[]): Promise<void> {
  const empty = args.includes("--empty");
  const yes = args.includes("--yes") || args.includes("-y");

  if (!empty) {
    console.log(formatTrashSummary(await inspectTrash()));
    return;
  }

  const summary = await inspectTrash();
  if (summary.files === 0) {
    console.log(formatTrashSummary(summary));
    return;
  }

  if (!yes) {
    const confirmed = await p.confirm({
      message: `permanently delete ${pc.bold(String(summary.files))} trashed rollout file(s), ${formatBytes(summary.bytes)}?`,
      active: "Yes, empty trash",
      inactive: "No, keep",
      initialValue: false,
    });
    if (!confirmed || p.isCancel(confirmed)) {
      exitCleanly("kept trash; no files deleted");
      return;
    }
  }

  const deleted = await emptyTrash();
  console.log(`emptied trash (${deleted.files} file(s), ${formatBytes(deleted.bytes)})`);
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

function trashLocation(r: PurgeResult, opts: DeleteOptions): string {
  if (opts.hard || r.trashedFiles === 0) return "";
  return pc.dim(`\ntrash: ${shortenCwd(paths.trash)}`);
}

function restartNote(): string {
  return pc.dim("\nrestart Codex if old sessions still appear in the GUI");
}

function exitCleanly(message: string): void {
  p.outro(pc.dim(message));
}

function renderOptionLabel(t: Thread): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const project = pc.cyan(truncate(projectName(t.cwd), 20).padEnd(20));
  const title = truncate(t.title, 48).padEnd(48);
  const tag = t.archived ? pc.yellow("archived") : pc.green("active  ");
  return `${pc.dim(age)}  ${project}  ${title}  ${tag}`;
}

function renderChosenLine(t: Thread): string {
  return `${projectName(t.cwd)} - ${truncate(t.title, 72)}`;
}

function formatTrashSummary(summary: TrashSummary): string {
  if (summary.files === 0) return `trash empty (${shortenCwd(summary.root)})`;

  const lines = [
    `trash: ${shortenCwd(summary.root)}`,
    `total: ${summary.files} file(s), ${formatBytes(summary.bytes)}`,
  ];
  for (const bucket of summary.buckets) {
    lines.push(`${bucket.name}  ${String(bucket.files).padStart(4)} file(s)  ${formatBytes(bucket.bytes)}`);
  }
  return lines.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (const next of units.slice(1)) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}
