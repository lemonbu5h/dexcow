import * as p from "@clack/prompts";
import pc from "picocolors";
import { purgeThreads, type PurgeResult } from "./purge.ts";
import { findLockedThreadIds } from "./sessionArtifacts.ts";
import { listThreads, openDb, type Thread, type ThreadScope } from "./threads.ts";
import {
  formatThreadGroups,
  groupThreadsByProject,
  type ThreadGroup,
  projectName,
  relativeTime,
  shortenCwd,
  threadGroupLabel,
  truncate,
} from "./format.ts";

export async function runInteractive(scope: ThreadScope = "active"): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(" dexcow ")) + pc.dim(" cow eats Codex sessions"));

  const db = openDb();
  try {
    const threads = await listThreads(db, { scope });
    if (threads.length === 0) {
      p.note(scope === "archived" ? "No archived Codex sessions found." : "No Codex sessions found.", "empty");
      p.outro("nothing to eat 🐄");
      return;
    }

    const lockedIds = new Set(findLockedThreadIds(new Set(threads.map((thread) => thread.id))));
    const target = await pickInteractiveGroup(threads, lockedIds);
    if (p.isCancel(target)) {
      exitCleanly("exited; no changes made");
      return;
    }

    const lockedThreads = target.threads.filter((thread) => lockedIds.has(thread.id));
    const availableThreads = target.threads.filter((thread) => !lockedIds.has(thread.id));
    if (lockedThreads.length > 0) {
      p.note(lockedThreads.map(renderLockedLine).join("\n"), "open in Codex; unavailable");
    }
    if (availableThreads.length === 0) {
      p.outro("close an open task in Codex and try again");
      return;
    }

    const picked = await p.multiselect<string>({
      message: "Pick sessions to delete (space toggles, enter continues, q exits)",
      options: availableThreads.map((thread) => ({
        value: thread.id,
        label: renderSessionOptionLabel(thread),
      })),
      maxItems: 12,
      required: true,
    });

    if (p.isCancel(picked)) {
      exitCleanly("exited; no changes made");
      return;
    }

    const ids = new Set(picked);
    let chosen = availableThreads.filter((t) => ids.has(t.id));
    const newlyLockedIds = new Set(findLockedThreadIds(new Set(chosen.map((thread) => thread.id))));
    if (newlyLockedIds.size > 0) {
      const newlyLocked = chosen.filter((thread) => newlyLockedIds.has(thread.id));
      p.note(newlyLocked.map(renderLockedLine).join("\n"), "opened in Codex; removed from selection");
      chosen = chosen.filter((thread) => !newlyLockedIds.has(thread.id));
    }
    if (chosen.length === 0) {
      p.outro("no available sessions selected; no changes made");
      return;
    }
    p.note(chosen.map(renderChosenLine).join("\n"), "selected");
    const confirmed = await p.confirm({
      message: `permanently delete ${pc.bold(String(chosen.length))} session(s)?`,
      active: "Yes, delete",
      inactive: "No, keep",
      initialValue: false,
    });
    if (!confirmed || p.isCancel(confirmed)) {
      exitCleanly("kept selected session(s); no changes made");
      return;
    }

    const result = await purgeThreads(db, chosen, {});
    p.outro(summarize(result) + refreshNote());
  } finally {
    db.close();
  }
}

export async function runList(scope: ThreadScope = "active"): Promise<void> {
  const db = openDb();
  try {
    const threads = await listThreads(db, { scope });
    if (threads.length === 0) {
      console.log("(no sessions)");
      return;
    }
    const lockedIds = new Set(findLockedThreadIds(new Set(threads.map((thread) => thread.id))));
    console.log(formatThreadGroups(threads, lockedIds));
  } finally {
    db.close();
  }
}

export async function runRemove(ids: string[], confirmed: boolean): Promise<void> {
  if (ids.length === 0) {
    console.error("usage: dexcow rm <id> [id...] --yes");
    process.exit(2);
  }
  if (!confirmed) {
    console.error("refusing permanent deletion without --yes");
    process.exit(2);
  }
  const db = openDb();
  try {
    const threads = await listThreads(db, { scope: "all" });
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
    const result = await purgeThreads(db, chosen, {});
    console.log(summarize(result) + refreshNote());
  } finally {
    db.close();
  }
}

function summarize(r: PurgeResult): string {
  const main = `deleted ${r.removed} session(s)`;
  const details = [
    `${r.stateRows} state row(s)`,
    `${r.logRows} log row(s)`,
    `${r.sessionIndexRows} index row(s)`,
  ];
  if (r.catalogRows > 0) details.push(`${r.catalogRows} catalog row(s)`);
  if (r.timelineRows > 0) details.push(`${r.timelineRows} timeline row(s)`);
  if (r.historySnapshotRows > 0) details.push(`${r.historySnapshotRows} history snapshot(s)`);
  if (r.automationRunRows > 0) details.push(`${r.automationRunRows} automation run(s)`);
  if (r.inboxRows > 0) details.push(`${r.inboxRows} inbox item(s)`);
  if (r.shellSnapshots > 0) details.push(`${r.shellSnapshots} shell snapshot(s)`);
  if (r.missingFiles > 0) details.push(`${r.missingFiles} rollout file(s) already missing`);
  const note = pc.dim(` (${details.join(", ")})`);
  return main + note;
}

function refreshNote(): string {
  return pc.dim("\nrefresh Codex if old sessions still appear (collapse or expand the repo usually works)");
}

function exitCleanly(message: string): void {
  p.outro(pc.dim(message));
}

async function pickInteractiveGroup(
  threads: Thread[],
  lockedIds: ReadonlySet<string>,
): Promise<ThreadGroup | symbol> {
  const groups = groupThreadsByProject(threads);
  if (groups.length === 1) return groups[0]!;

  const chosen = await p.select<string>({
    message: "Pick a repo or unlinked sessions",
    options: groups.map((group) => ({
      value: group.id,
      label: renderRepoOptionLabel(group, groups, lockedIds),
    })),
    maxItems: 12,
  });

  if (p.isCancel(chosen)) return chosen;
  return groups.find((group) => group.id === chosen) ?? groups[0]!;
}

function renderRepoOptionLabel(
  group: ThreadGroup,
  allGroups: ThreadGroup[],
  lockedIds: ReadonlySet<string>,
): string {
  const displayName = threadGroupLabel(group, allGroups);
  const name = truncate(displayName, 28).padEnd(28);
  const count = `${group.threads.length} session${group.threads.length === 1 ? "" : "s"}`;
  const lockedCount = group.threads.filter((thread) => lockedIds.has(thread.id)).length;
  const locked = lockedCount > 0 ? `  ${pc.yellow(`${lockedCount} locked`)}` : "";
  return `${name}  ${count}${locked}`;
}

function renderSessionOptionLabel(t: Thread): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const title = truncate(t.title, 54).padEnd(54);
  const tag = t.archived ? pc.yellow("archived") : pc.green("active  ");
  return `${pc.dim(age)}  ${title}  ${tag}`;
}

function renderChosenLine(t: Thread): string {
  return `${projectName(t.cwd)} - ${truncate(t.title, 72)}`;
}

function renderLockedLine(t: Thread): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const title = truncate(t.title, 62);
  return `${pc.dim(age)}  ${title}  ${pc.yellow("locked")}`;
}
