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

test("groupThreadsByProject clusters sessions by cwd and sorts recent repos first", () => {
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

test("formatThreadGroupHeader disambiguates duplicate repo names", () => {
  const groups = groupThreadsByProject([
    thread("/Users/queen/Projects/work/app", { id: "work" }),
    thread("/Users/queen/Projects/personal/app", { id: "personal" }),
  ]);

  expect(formatThreadGroupHeader(groups[0]!, groups)).toContain("/app");
  expect(formatThreadGroupHeader(groups[1]!, groups)).toContain("/app");
});

function thread(cwd: string, overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    title: "Clean up sessions",
    rolloutPath: "/Users/queen/.codex/sessions/rollout.jsonl",
    cwd,
    updatedAt: new Date(),
    archived: false,
    ...overrides,
  };
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}
