import { homedir } from "node:os";
import { join } from "node:path";

const CODEX_HOME = process.env.CODEX_HOME ?? join(homedir(), ".codex");

// All file operations are anchored from CODEX_HOME so tests and local Codex installs can opt in explicitly.
export const paths = {
  codexHome: CODEX_HOME,
  stateDb: join(CODEX_HOME, "state_5.sqlite"),
  logsDb: join(CODEX_HOME, "logs_2.sqlite"),
  sessions: join(CODEX_HOME, "sessions"),
  sessionIndex: join(CODEX_HOME, "session_index.jsonl"),
  trash: join(CODEX_HOME, ".dexcow-trash"),
} as const;
