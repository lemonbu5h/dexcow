import { expect, test } from "bun:test";
import {
  formatThreadGroupHeader,
  formatThreadGroups,
  formatThreadLine,
  groupThreadsByProject,
  projectName,
} from "../src/format.ts";
import type { Thread } from "../src/threads.ts";

test("projectName uses the cwd basename", () => {
  expect(projectName("/Users/queen/Projects/dexcow")).toBe("dexcow");
});

test("formatThreadLine shows the project name instead of the full cwd", () => {
  const line = formatThreadLine(thread("/Users/queen/Projects/dexcow"));

  expect(line).toContain("dexcow");
  expect(line).not.toContain("/Users/queen/Projects/dexcow");
});

test("groupThreadsByProject clusters sessions by Git origin and sorts recent repos first", () => {
  const threads = [
    thread("/Users/queen/Projects/website", { id: "old-site", updatedAt: minutesAgo(120) }),
    thread("/Users/queen/Projects/dexcow", { id: "new-cow", updatedAt: minutesAgo(5) }),
    thread("/Users/queen/Projects/website", { id: "new-site", updatedAt: minutesAgo(30) }),
  ];

  const groups = groupThreadsByProject(threads);

  expect(groups.map((group) => group.project)).toEqual(["dexcow", "website"]);
  expect(groups[1]?.threads.map((thread) => thread.id)).toEqual(["new-site", "old-site"]);
});

test("formatThreadGroups starts with a neutral total and repo blocks", () => {
  const output = formatThreadGroups([
    thread("/Users/queen/Projects/dexcow", { id: "thread-1" }),
    thread("/Users/queen/Projects/dexcow", { id: "thread-2" }),
  ]);

  expect(output).toContain("Total 2 sessions");
  expect(output).toContain("dexcow");
  expect(output).not.toContain("/Users/queen/Projects/dexcow");
});

test("formatThreadGroups displays full titles with status after the title", () => {
  const output = formatThreadGroups([
    thread("/Users/queen/Projects/dexcow", {
      title: "Check repo policy compliance",
      updatedAt: minutesAgo(5),
    }),
  ]);

  expect(output).toContain("Check repo policy compliance");
  expect(output).not.toContain("  …");
  expect(output.indexOf("Check repo policy compliance")).toBeLessThan(output.indexOf("active"));
});

test("formatThreadGroups shows lock availability separately from Codex status", () => {
  const session = thread("/Users/queen/Projects/dexcow", { id: "locked-thread" });
  const output = formatThreadGroups([session], new Set([session.id]));

  expect(output).toContain("active");
  expect(output).toContain("locked");
  expect(output.indexOf("active")).toBeLessThan(output.indexOf("locked"));
});

test("formatThreadGroupHeader disambiguates duplicate repo names", () => {
  const groups = groupThreadsByProject([
    thread("/Users/queen/Projects/work/app", { id: "work", gitOriginUrl: "git@github.com:work/app.git" }),
    thread("/Users/queen/Projects/personal/app", { id: "personal", gitOriginUrl: "git@github.com:personal/app.git" }),
  ]);

  expect(formatThreadGroupHeader(groups[0]!, groups)).toContain("/app");
  expect(formatThreadGroupHeader(groups[1]!, groups)).toContain("/app");
});

test("groupThreadsByProject collapses worktrees by canonical Git origin", () => {
  const groups = groupThreadsByProject([
    thread("/Users/queen/.codex/worktrees/one/repo", {
      id: "one",
      gitOriginUrl: "git@github.com:demo/repo.git",
    }),
    thread("/Users/queen/.codex/worktrees/two/repo", {
      id: "two",
      gitOriginUrl: "https://github.com/demo/repo",
    }),
    thread("/existing/repo", {
      id: "repo",
      gitOriginUrl: "git@github.com:demo/repo.git",
    }),
  ]);

  expect(groups[0]).toMatchObject({
    id: "repo:github.com/demo/repo",
    kind: "project",
    project: "repo",
    cwd: "/existing/repo",
  });
  expect(groups[0]?.threads.map((item) => item.id).sort()).toEqual(["one", "repo", "two"]);
});

test("sessions without a Git origin are unlinked without colliding with a real repo", () => {
  const groups = groupThreadsByProject([
    thread("/existing/Unlinked sessions", {
      id: "real",
      gitOriginUrl: "git@github.com:demo/unlinked-sessions.git",
    }),
    thread("/removed/folder", { id: "missing", gitOriginUrl: "" }),
  ]);

  const real = groups.find((group) => group.kind === "project")!;
  expect(groups[0]).toMatchObject({ id: "dexcow:unlinked", kind: "unlinked" });
  expect(real.id).toBe("repo:github.com/demo/unlinked-sessions");
  expect(formatThreadGroupHeader(real, groups)).toContain("existing/Unlinked sessions");
});

function thread(cwd: string, overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    title: "Clean up sessions",
    rolloutPath: "/Users/queen/.codex/sessions/rollout.jsonl",
    cwd,
    gitOriginUrl: `git@github.com:demo/${projectName(cwd)}.git`,
    updatedAt: new Date(),
    archived: false,
    ...overrides,
  };
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}
