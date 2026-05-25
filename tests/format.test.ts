import { expect, test } from "bun:test";
import { formatThreadLine, projectName } from "../src/format.ts";
import type { Thread } from "../src/threads.ts";

test("projectName uses the cwd basename", () => {
  expect(projectName("/Users/queen/Projects/dexcow")).toBe("dexcow");
});

test("formatThreadLine shows the project name instead of the full cwd", () => {
  const line = formatThreadLine(thread("/Users/queen/Projects/dexcow"));

  expect(line).toContain("dexcow");
  expect(line).not.toContain("/Users/queen/Projects/dexcow");
});

function thread(cwd: string): Thread {
  return {
    id: "thread-1",
    title: "Clean up sessions",
    rolloutPath: "/Users/queen/.codex/sessions/rollout.jsonl",
    cwd,
    updatedAt: new Date(),
    archived: false,
  };
}
