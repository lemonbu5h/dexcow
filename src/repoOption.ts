import pc from "picocolors";
import { threadGroupLabel, truncate, type ThreadGroup } from "./format.ts";

export function renderRepoOptionLabel(
  group: ThreadGroup,
  allGroups: ThreadGroup[],
  lockedIds: ReadonlySet<string>,
): string {
  const name = truncate(threadGroupLabel(group, allGroups), 28).padEnd(28);
  const count = sessionCount(group);
  const countWidth = Math.max(count.length, ...allGroups.map((item) => sessionCount(item).length));
  const lockedCount = group.threads.filter((thread) => lockedIds.has(thread.id)).length;
  const locked = lockedCount > 0 ? `        ${pc.yellow(`${lockedCount} locked`)}` : "";
  return `${name}  ${count.padEnd(countWidth)}${locked}`;
}

function sessionCount(group: ThreadGroup): string {
  const count = group.threads.length;
  return `${count} ${count === 1 ? "session" : "sessions"}`;
}
