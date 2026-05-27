import { homedir } from "node:os";
import { basename, dirname } from "node:path";
import pc from "picocolors";
import type { Thread } from "./threads.ts";

const HOME = homedir();

export interface ThreadGroup {
  cwd: string;
  project: string;
  threads: Thread[];
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + "…";
}

export function relativeTime(date: Date, now: Date = new Date()): string {
  const secs = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86_400) return `${Math.round(secs / 3600)}h`;
  if (secs < 30 * 86_400) return `${Math.round(secs / 86_400)}d`;
  if (secs < 365 * 86_400) return `${Math.round(secs / (30 * 86_400))}mo`;
  return `${Math.round(secs / (365 * 86_400))}y`;
}

export function shortenCwd(cwd: string): string {
  return cwd.startsWith(HOME) ? "~" + cwd.slice(HOME.length) : cwd;
}

export function projectName(cwd: string): string {
  const name = basename(cwd);
  return name.length === 0 ? shortenCwd(cwd) : name;
}

export function formatThreadLine(t: Thread, titleWidth = 40): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const tag = t.archived ? pc.yellow("[archived]") : pc.dim("[active]  ");
  const project = truncate(projectName(t.cwd), 24).padEnd(24);
  const title = truncate(t.title, titleWidth).padEnd(titleWidth);
  return `${pc.dim(age)}  ${tag}  ${pc.cyan(project)}  ${title}`;
}

export function groupThreadsByProject(threads: Thread[]): ThreadGroup[] {
  const groups = new Map<string, ThreadGroup>();
  for (const thread of threads) {
    const group = groups.get(thread.cwd);
    if (group) {
      group.threads.push(thread);
      continue;
    }
    groups.set(thread.cwd, { cwd: thread.cwd, project: projectName(thread.cwd), threads: [thread] });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      threads: [...group.threads].sort(compareThreadsByRecent),
    }))
    .sort((a, b) => compareThreadsByRecent(a.threads[0], b.threads[0]));
}

export function formatThreadGroups(threads: Thread[]): string {
  const total = `Total ${threads.length} ${plural(threads.length, "session")}`;
  const groups = groupThreadsByProject(threads);
  const blocks = groups.map((group) => {
    const header = formatThreadGroupHeader(group, groups);
    const rows = group.threads.map(formatGroupedThreadLine);
    return [header, ...rows].join("\n");
  });
  return [total, ...blocks].join("\n\n");
}

export function formatThreadGroupHeader(group: ThreadGroup, allGroups: ThreadGroup[]): string {
  const name = groupLabel(group, allGroups);
  const count = `${group.threads.length} ${plural(group.threads.length, "session")}`;
  return `${pc.cyan(name)}  ${pc.dim(count)}`;
}

export function formatGroupedThreadLine(t: Thread, titleWidth = 56): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const tag = t.archived ? pc.yellow("archived") : pc.green("active  ");
  const title = truncate(t.title, titleWidth);
  return `  ${pc.dim(age)}  ${tag}  ${title}`;
}

function compareThreadsByRecent(a: Thread | undefined, b: Thread | undefined): number {
  if (!a || !b) return 0;
  const byDate = b.updatedAt.getTime() - a.updatedAt.getTime();
  return byDate === 0 ? b.id.localeCompare(a.id) : byDate;
}

function groupLabel(group: ThreadGroup, allGroups: ThreadGroup[]): string {
  const duplicateName = allGroups.some((other) => other.cwd !== group.cwd && other.project === group.project);
  if (!duplicateName) return group.project;
  return `${basename(dirname(group.cwd))}/${group.project}`;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
