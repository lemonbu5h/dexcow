import { expect, spyOn, test } from "bun:test";
import { requirePurgeConfirmation, runAgent, selectSessions, type AgentDependencies } from "../src/agent.ts";
import type { PurgeResult } from "../src/purge.ts";
import type { TrashSummary } from "../src/trash.ts";
import type { Thread } from "../src/threads.ts";

test("agent help describes the structured commands", async () => {
  const fixture = createFixture();

  await runAgent(["help"], fixture.dependencies);

  expect(fixture.output).toEqual([
    {
      commands: [
        "list",
        "purge <id...> --confirm [--hard --confirm-hard]",
        "trash",
        "trash --empty --confirm",
      ],
      safety: "List first, show the selected sessions, and obtain explicit user confirmation before destructive commands.",
    },
  ]);
});

test("agent default writer emits JSON help without opening Codex stores", async () => {
  const log = spyOn(console, "log").mockImplementation(() => undefined);
  try {
    await runAgent(["help"]);
    const help = JSON.parse(String(log.mock.calls[0]?.[0])) as { commands: string[] };
    expect(help.commands).toContain("list");
    expect(help.commands).toContain("purge <id...> --confirm [--hard --confirm-hard]");
  } finally {
    log.mockRestore();
  }
});

test("agent lists sessions as structured data", async () => {
  const fixture = createFixture();

  await runAgent(["list"], fixture.dependencies);

  expect(fixture.output[0]).toMatchObject({
    operation: "list",
    sessions: [{ id: "thread-1", title: "Demo session", cwd: "/tmp/demo", archived: false }],
  });
});

test("agent purge requires explicit confirmation", () => {
  expect(() => requirePurgeConfirmation(["thread-1"], false, { confirm: false, confirmHard: false })).toThrow(
    "purging requires --confirm",
  );
});

test("agent purges selected sessions only after confirmation", async () => {
  const fixture = createFixture();

  await runAgent(["purge", "thread-1", "--confirm"], fixture.dependencies);

  expect(fixture.purgeCalls).toEqual([{ ids: ["thread-1"], hard: false }]);
  expect(fixture.output[0]).toMatchObject({
    operation: "purge",
    mode: "trash",
    sessions: [{ id: "thread-1" }],
    result: { removed: 1 },
  });
});

test("agent hard purge requires a second confirmation", () => {
  expect(() => requirePurgeConfirmation(["thread-1"], true, { confirm: true, confirmHard: false })).toThrow(
    "hard purging requires --confirm-hard",
  );
});

test("agent hard purge records the requested mode", async () => {
  const fixture = createFixture();

  await runAgent(["purge", "thread-1", "--confirm", "--hard", "--confirm-hard"], fixture.dependencies);

  expect(fixture.purgeCalls).toEqual([{ ids: ["thread-1"], hard: true }]);
  expect(fixture.output[0]).toMatchObject({ operation: "purge", mode: "hard" });
});

test("agent session selection rejects unknown ids before purging", () => {
  expect(() => selectSessions([thread("thread-1")], ["thread-1", "missing"])).toThrow(
    "session id(s) not found: missing",
  );
});

test("agent lists and empties trash only after confirmation", async () => {
  const fixture = createFixture();

  await runAgent(["trash"], fixture.dependencies);
  await expect(runAgent(["trash", "--empty"], fixture.dependencies)).rejects.toThrow("emptying trash requires --confirm");
  await runAgent(["trash", "--empty", "--confirm"], fixture.dependencies);

  expect(fixture.output).toEqual([
    { operation: "trash", summary: fixture.trashSummary },
    { operation: "trash-empty", result: fixture.trashSummary },
  ]);
});

function createFixture() {
  const output: unknown[] = [];
  const purgeCalls: Array<{ ids: string[]; hard: boolean }> = [];
  const sessions = [thread("thread-1")];
  const trashSummary: TrashSummary = { root: "/tmp/.dexcow-trash", files: 1, bytes: 12, buckets: [] };
  const purgeResult: PurgeResult = {
    removed: 1,
    stateRows: 1,
    logRows: 0,
    sessionIndexRows: 0,
    trashedFiles: 1,
    deletedFiles: 0,
    missingFiles: 0,
  };
  const dependencies: AgentDependencies = {
    async loadSessions() {
      return sessions;
    },
    async purge(selected, options) {
      purgeCalls.push({ ids: selected.map((session) => session.id), hard: options.hard });
      return purgeResult;
    },
    async inspectTrash() {
      return trashSummary;
    },
    async emptyTrash() {
      return trashSummary;
    },
    write(value) {
      output.push(value);
    },
  };
  return { dependencies, output, purgeCalls, trashSummary };
}

function thread(id: string): Thread {
  return {
    id,
    title: "Demo session",
    rolloutPath: "/tmp/demo.jsonl",
    cwd: "/tmp/demo",
    updatedAt: new Date("2026-06-19T00:00:00Z"),
    archived: false,
  };
}
