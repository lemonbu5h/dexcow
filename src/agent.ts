#!/usr/bin/env bun
import { parseArgs } from "./args.ts";
import { purgeThreads, type PurgeResult } from "./purge.ts";
import { emptyTrash, inspectTrash, type TrashSummary } from "./trash.ts";
import { listThreads, openDb, type Thread } from "./threads.ts";

interface AgentSession {
  id: string;
  title: string;
  cwd: string;
  updatedAt: string;
  archived: boolean;
}

interface AgentOptions {
  confirm: boolean;
  confirmHard: boolean;
}

export interface AgentDependencies {
  loadSessions(): Promise<Thread[]>;
  purge(sessions: Thread[], options: { hard: boolean }): Promise<PurgeResult>;
  inspectTrash(): Promise<TrashSummary>;
  emptyTrash(): Promise<TrashSummary>;
  write(value: unknown): void;
}

const REFRESH_NOTE = "Refresh Codex if old sessions still appear; collapsing and expanding the repo usually refreshes the list.";

export async function runAgent(argv: string[], dependencies: AgentDependencies = defaultDependencies): Promise<void> {
  const parsed = parseArgs(argv);
  const options = confirmationOptions(argv);

  if (parsed.help || parsed.command === undefined || parsed.command === "help") {
    dependencies.write({
      commands: [
        "list",
        "purge <id...> --confirm [--hard --confirm-hard]",
        "trash",
        "trash --empty --confirm",
      ],
      safety: "List first, show the selected sessions, and obtain explicit user confirmation before destructive commands.",
    });
    return;
  }

  switch (parsed.command) {
    case "list":
      await listSessions(dependencies);
      return;
    case "purge":
      await purgeSessions(parsed.commandPositionals, parsed.hard, options, dependencies);
      return;
    case "trash":
      await manageTrash(parsed.commandArgs, options, dependencies);
      return;
    default:
      throw new Error(`unknown command: ${parsed.command}`);
  }
}

async function listSessions(dependencies: AgentDependencies): Promise<void> {
  const sessions = await dependencies.loadSessions();
  dependencies.write({ operation: "list", sessions: sessions.map(sessionForAgent) });
}

async function purgeSessions(ids: string[], hard: boolean, options: AgentOptions, dependencies: AgentDependencies): Promise<void> {
  requirePurgeConfirmation(ids, hard, options);
  const selected = selectSessions(await dependencies.loadSessions(), ids);
  const result = await dependencies.purge(selected, { hard });
  dependencies.write({
    operation: "purge",
    mode: hard ? "hard" : "trash",
    sessions: selected.map(sessionForAgent),
    result,
    refresh: REFRESH_NOTE,
  });
}

async function manageTrash(args: string[], options: AgentOptions, dependencies: AgentDependencies): Promise<void> {
  const empty = args.includes("--empty");
  if (!empty) {
    dependencies.write({ operation: "trash", summary: await dependencies.inspectTrash() });
    return;
  }

  if (!options.confirm) {
    throw new Error("emptying trash requires --confirm after explicit user confirmation");
  }

  dependencies.write({ operation: "trash-empty", result: await dependencies.emptyTrash() });
}

export function requirePurgeConfirmation(ids: string[], hard: boolean, options: AgentOptions): void {
  if (ids.length === 0) {
    throw new Error("usage: dexcow-agent purge <id...> --confirm [--hard --confirm-hard]");
  }
  if (!options.confirm) {
    throw new Error("purging requires --confirm after explicit user confirmation");
  }
  if (hard && !options.confirmHard) {
    throw new Error("hard purging requires --confirm-hard after a separate explicit user confirmation");
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
    confirmHard: argv.includes("--confirm-hard"),
  };
}

function sessionForAgent(session: Thread): AgentSession {
  return {
    id: session.id,
    title: session.title,
    cwd: session.cwd,
    updatedAt: session.updatedAt.toISOString(),
    archived: session.archived,
  };
}

const defaultDependencies: AgentDependencies = {
  loadSessions: loadLocalSessions,
  async purge(sessions, options): Promise<PurgeResult> {
    const db = openDb();
    try {
      return await purgeThreads(db, sessions, options);
    } finally {
      db.close();
    }
  },
  inspectTrash,
  emptyTrash,
  write(value: unknown): void {
    console.log(JSON.stringify(value, null, 2));
  },
};

async function loadLocalSessions(): Promise<Thread[]> {
  const db = openDb();
  try {
    return await listThreads(db);
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
