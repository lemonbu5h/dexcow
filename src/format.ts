import { homedir } from "node:os";
import { basename } from "node:path";
import pc from "picocolors";
import type { Thread } from "./threads.ts";

const HOME = homedir();

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
