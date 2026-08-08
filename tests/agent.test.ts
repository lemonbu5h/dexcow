import { expect, spyOn, test } from "bun:test";
import { requirePurgeConfirmation, runAgent, selectSessions, type AgentDependencies } from "../src/agent.ts";
import type { PurgeResult } from "../src/purge.ts";
import type { Thread } from "../src/threads.ts";

test("agent help describes the structured commands", async () => {
  const fixture = createFixture();

  await runAgent(["help"], fixture.dependencies);

  expect(fixture.output).toEqual([
    {
      commands: ["list [--archived]", "purge <id...> --confirm"],
      safety: "List first, show the selected sessions, and obtain explicit user confirmation before destructive commands.",
    },
  ]);
});

test("agent default writer emits JSON help without opening Codex stores", async () => {
  const log = spyOn(console, "log").mockImplementation(() => undefined);
  try {
    await runAgent(["help"]);
    const help = JSON.parse(String(log.mock.calls[0]?.[0])) as { commands: string[] };
    expect(help.commands).toContain("list [--archived]");
    expect(help.commands).toContain("purge <id...> --confirm");
  } finally {
    log.mockRestore();
  }
});

test("agent lists sessions as structured data", async () => {
  const fixture = createFixture();

  await runAgent(["list"], fixture.dependencies);

  expect(fixture.output[0]).toMatchObject({
    operation: "list",
    scope: "active",
    sessions: [{ id: "thread-1", title: "Demo session", cwd: "/tmp/demo", archived: false }],
  });
});

test("agent lists archived sessions only when requested", async () => {
  const fixture = createFixture();

  await runAgent(["list", "--archived"], fixture.dependencies);

  expect(fixture.output[0]).toMatchObject({
    operation: "list",
    scope: "archived",
    sessions: [{ id: "thread-2", archived: true }],
  });
});

test("agent purge requires explicit confirmation", () => {
  expect(() => requirePurgeConfirmation(["thread-1"], { confirm: false })).toThrow(
    "purging requires --confirm",
  );
});

test("agent purges selected sessions only after confirmation", async () => {
  const fixture = createFixture();

  await runAgent(["purge", "thread-1", "--confirm"], fixture.dependencies);

  expect(fixture.purgeCalls).toEqual([{ ids: ["thread-1"] }]);
  expect(fixture.output[0]).toMatchObject({
    operation: "purge",
    mode: "delete",
    sessions: [{ id: "thread-1" }],
    result: { removed: 1 },
  });
});

test("agent session selection rejects unknown ids before purging", () => {
  expect(() => selectSessions([thread("thread-1")], ["thread-1", "missing"])).toThrow(
    "session id(s) not found: missing",
  );
});

function createFixture() {
  const output: unknown[] = [];
  const purgeCalls: Array<{ ids: string[] }> = [];
  const activeSessions = [thread("thread-1")];
  const archivedSessions = [thread("thread-2", { archived: true })];
  const purgeResult: PurgeResult = {
    removed: 1,
    stateRows: 1,
    logRows: 0,
    sessionIndexRows: 0,
    deletedFiles: 1,
    missingFiles: 0,
    catalogRows: 0,
    timelineRows: 0,
    automationRunRows: 0,
    inboxRows: 0,
    historySnapshotRows: 0,
    shellSnapshots: 0,
  };
  const dependencies: AgentDependencies = {
    async loadSessions(scope = "active") {
      if (scope === "archived") return archivedSessions;
      if (scope === "all") return [...activeSessions, ...archivedSessions];
      return activeSessions;
    },
    async purge(selected) {
      purgeCalls.push({ ids: selected.map((session) => session.id) });
      return purgeResult;
    },
    write(value) {
      output.push(value);
    },
  };
  return { dependencies, output, purgeCalls };
}

function thread(id: string, overrides: Partial<Thread> = {}): Thread {
  return {
    id,
    title: "Demo session",
    rolloutPath: "/tmp/demo.jsonl",
    cwd: "/tmp/demo",
    gitOriginUrl: "git@github.com:demo/repo.git",
    updatedAt: new Date("2026-06-19T00:00:00Z"),
    archived: false,
    ...overrides,
  };
}
