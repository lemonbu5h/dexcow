#!/usr/bin/env bun
import { parseArgs } from "./args.ts";
import { purgeThreads, type PurgeResult } from "./purge.ts";
import { findLockedThreadIds } from "./sessionArtifacts.ts";
import { listThreads, openDb, type Thread, type ThreadScope } from "./threads.ts";

interface AgentSession {
  id: string;
  title: string;
  cwd: string;
  updatedAt: string;
  archived: boolean;
  locked: boolean;
}

interface AgentOptions {
  confirm: boolean;
}

export interface AgentDependencies {
  loadSessions(scope?: ThreadScope): Promise<Thread[]>;
  findLockedIds(sessions: Thread[]): Set<string>;
  purge(sessions: Thread[]): Promise<PurgeResult>;
  write(value: unknown): void;
}

const REFRESH_NOTE = "Refresh Codex if old sessions still appear; collapsing and expanding the repo usually refreshes the list.";

export async function runAgent(argv: string[], dependencies: AgentDependencies = defaultDependencies): Promise<void> {
  const parsed = parseArgs(argv);
  const options = confirmationOptions(argv);

  if (parsed.help || parsed.command === undefined || parsed.command === "help") {
    dependencies.write({
      commands: ["list [--archived]", "purge <id...> --confirm"],
      safety: "List first, show the selected sessions, and obtain explicit user confirmation before destructive commands.",
    });
    return;
  }

  switch (parsed.command) {
    case "list":
      await listSessions(parsed.archived ? "archived" : "active", dependencies);
      return;
    case "purge":
      await purgeSessions(parsed.commandPositionals, options, dependencies);
      return;
    default:
      throw new Error(`unknown command: ${parsed.command}`);
  }
}

async function listSessions(scope: ThreadScope, dependencies: AgentDependencies): Promise<void> {
  const sessions = await dependencies.loadSessions(scope);
  const lockedIds = dependencies.findLockedIds(sessions);
  dependencies.write({
    operation: "list",
    scope,
    sessions: sessions.map((session) => sessionForAgent(session, lockedIds.has(session.id))),
  });
}

async function purgeSessions(ids: string[], options: AgentOptions, dependencies: AgentDependencies): Promise<void> {
  requirePurgeConfirmation(ids, options);
  const selected = selectSessions(await dependencies.loadSessions("all"), ids);
  const result = await dependencies.purge(selected);
  dependencies.write({
    operation: "purge",
    mode: "delete",
    sessions: selected.map((session) => sessionForAgent(session, false)),
    result,
    refresh: REFRESH_NOTE,
  });
}

export function requirePurgeConfirmation(ids: string[], options: AgentOptions): void {
  if (ids.length === 0) {
    throw new Error("usage: dexcow-agent purge <id...> --confirm");
  }
  if (!options.confirm) {
    throw new Error("purging requires --confirm after explicit user confirmation");
  }
}

export function selectSessions(sessions: Thread[], ids: string[]): Thread[] {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const uniqueIds = [...new Set(ids)];
  const missing = uniqueIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`session id(s) not found: ${missing.join(", ")}`);
  }
  return uniqueIds.map((id) => byId.get(id)!);
}

function confirmationOptions(argv: string[]): AgentOptions {
  return {
    confirm: argv.includes("--confirm"),
  };
}

function sessionForAgent(session: Thread, locked: boolean): AgentSession {
  return {
    id: session.id,
    title: session.title,
    cwd: session.cwd,
    updatedAt: session.updatedAt.toISOString(),
    archived: session.archived,
    locked,
  };
}

const defaultDependencies: AgentDependencies = {
  loadSessions: loadLocalSessions,
  findLockedIds(sessions): Set<string> {
    return new Set(findLockedThreadIds(new Set(sessions.map((session) => session.id))));
  },
  async purge(sessions): Promise<PurgeResult> {
    const db = openDb();
    try {
      return await purgeThreads(db, sessions, {});
    } finally {
      db.close();
    }
  },
  write(value: unknown): void {
    console.log(JSON.stringify(value, null, 2));
  },
};

async function loadLocalSessions(scope: ThreadScope = "active"): Promise<Thread[]> {
  const db = openDb();
  try {
    return await listThreads(db, { scope });
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  void runAgent(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }));
    process.exitCode = 1;
  });
}
