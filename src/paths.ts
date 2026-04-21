import { homedir } from "node:os";
import { join } from "node:path";

const CODEX_HOME = process.env.CODEX_HOME ?? join(homedir(), ".codex");

export const paths = {
  codexHome: CODEX_HOME,
  stateDb: join(CODEX_HOME, "state_5.sqlite"),
  sessions: join(CODEX_HOME, "sessions"),
  sessionIndex: join(CODEX_HOME, "session_index.jsonl"),
  trash: join(CODEX_HOME, ".dexcow-trash"),
} as const;
