import { expect, test } from "bun:test";
import { groupThreadsByProject, projectName } from "../src/format.ts";
import { renderRepoOptionLabel } from "../src/repoOption.ts";
import type { Thread } from "../src/threads.ts";

test("repo picker aligns and separates lock counts", () => {
  const sessions = [1, 12, 100].flatMap((count) =>
    Array.from({ length: count }, (_, index) => thread(`/repos/repo-${count}`, `${count}-${index}`)));
  const groups = groupThreadsByProject(sessions);
  const lockedIds = new Set(["1-0", "12-0", "100-0"]);
  const rows = groups.map((group) => Bun.stripANSI(renderRepoOptionLabel(group, groups, lockedIds)));

  expect(new Set(rows.map((row) => row.indexOf("1 locked"))).size).toBe(1);
  expect(rows.some((row) => row.includes("1 session "))).toBe(true);
  expect(rows.some((row) => row.includes("100 sessions"))).toBe(true);
  expect(rows.every((row) => row.includes("        1 locked"))).toBe(true);
  expect(renderRepoOptionLabel(groups[0]!, groups, new Set())).not.toContain("locked");
});

function thread(cwd: string, id: string): Thread {
  return {
    id,
    title: "Clean up sessions",
    rolloutPath: "/tmp/rollout.jsonl",
    cwd,
    gitOriginUrl: `git@github.com:demo/${projectName(cwd)}.git`,
    updatedAt: new Date(),
    archived: false,
  };
}
