import { homedir } from "node:os";
import { basename, dirname } from "node:path";
import pc from "picocolors";
import type { Thread } from "./threads.ts";

const HOME = homedir();

export interface ThreadGroup {
  id: string;
  cwd?: string;
  gitOriginUrl?: string;
  project: string;
  kind: "project" | "unlinked";
  threads: Thread[];
}

const UNLINKED_GROUP_ID = "dexcow:unlinked";
const UNLINKED_GROUP_NAME = "Unlinked sessions";

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
    const originId = canonicalGitOrigin(thread.gitOriginUrl);
    const linked = originId.length > 0;
    const groupId = linked ? `repo:${originId}` : UNLINKED_GROUP_ID;
    const group = groups.get(groupId);
    if (group) {
      group.threads.push(thread);
      continue;
    }
    groups.set(groupId, linked
      ? {
          id: groupId,
          cwd: thread.cwd,
          gitOriginUrl: thread.gitOriginUrl,
          project: projectName(thread.cwd),
          kind: "project",
          threads: [thread],
        }
      : { id: groupId, project: UNLINKED_GROUP_NAME, kind: "unlinked", threads: [thread] });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      ...preferredRepoDisplay(group),
      threads: [...group.threads].sort(compareThreadsByRecent),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "unlinked" ? -1 : 1;
      return compareThreadsByRecent(a.threads[0], b.threads[0]);
    });
}

export function formatThreadGroups(
  threads: Thread[],
): string {
  const total = `Total ${threads.length} ${plural(threads.length, "session")}`;
  const groups = groupThreadsByProject(threads);
  const blocks = groups.map((group) => {
    const header = formatThreadGroupHeader(group, groups);
    const rows = group.threads.map((thread) => formatGroupedThreadLine(thread));
    return [header, ...rows].join("\n");
  });
  return [total, ...blocks].join("\n\n");
}

export function formatThreadGroupHeader(group: ThreadGroup, allGroups: ThreadGroup[]): string {
  const name = threadGroupLabel(group, allGroups);
  const count = `${group.threads.length} ${plural(group.threads.length, "session")}`;
  return `${pc.cyan(name)}  ${pc.dim(count)}`;
}

export function formatGroupedThreadLine(t: Thread, titleWidth = 56): string {
  const age = relativeTime(t.updatedAt).padStart(4);
  const tag = t.archived ? pc.yellow("archived") : pc.green("active  ");
  const title = truncate(t.title, titleWidth).padEnd(titleWidth);
  return `  ${pc.dim(age)}  ${title}  ${tag}`;
}

function compareThreadsByRecent(a: Thread | undefined, b: Thread | undefined): number {
  if (!a || !b) return 0;
  const byDate = b.updatedAt.getTime() - a.updatedAt.getTime();
  return byDate === 0 ? b.id.localeCompare(a.id) : byDate;
}

export function threadGroupLabel(group: ThreadGroup, allGroups: ThreadGroup[]): string {
  if (group.kind === "unlinked") return `${UNLINKED_GROUP_NAME} (repo folder missing)`;
  const duplicateName = group.project === UNLINKED_GROUP_NAME
    || allGroups.some((other) => other.id !== group.id && other.project === group.project);
  if (!duplicateName) return group.project;
  return `${basename(dirname(group.cwd!))}/${group.project}`;
}

function preferredRepoDisplay(group: ThreadGroup): Pick<ThreadGroup, "cwd" | "project"> {
  if (group.kind === "unlinked") return { project: UNLINKED_GROUP_NAME };
  const primary = group.threads.find((thread) => !thread.cwd.includes("/.codex/worktrees/"));
  if (primary) return { cwd: primary.cwd, project: projectName(primary.cwd) };
  return { cwd: group.cwd, project: repoNameFromOrigin(group.gitOriginUrl ?? "") };
}

function canonicalGitOrigin(origin: string): string {
  return origin
    .trim()
    .replace(/^git@([^:]+):/, "$1/")
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .toLowerCase();
}

function repoNameFromOrigin(origin: string): string {
  const canonical = canonicalGitOrigin(origin);
  return canonical.split("/").at(-1) || "Repository";
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
