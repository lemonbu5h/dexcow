import { homedir } from "node:os";
import { join } from "node:path";

const CODEX_HOME = process.env.CODEX_HOME ?? join(homedir(), ".codex");

// All file operations are anchored from CODEX_HOME so tests and local Codex installs can opt in explicitly.
export const paths = {
  codexHome: CODEX_HOME,
  sessions: join(CODEX_HOME, "sessions"),
  archivedSessions: join(CODEX_HOME, "archived_sessions"),
  shellSnapshots: join(CODEX_HOME, "shell_snapshots"),
  threadWriterLocks: join(CODEX_HOME, "thread-writer-locks"),
  sessionIndex: join(CODEX_HOME, "session_index.jsonl"),
  desktopDb: join(CODEX_HOME, "sqlite", "codex-dev.db"),
  historySnapshotsDb: join(CODEX_HOME, "sqlite", "codex-history-snapshots-dev.db"),
} as const;
