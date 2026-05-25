import pc from "picocolors";
import { paths } from "./paths.ts";

const MAIN_HELP = `${pc.bold("dexcow")} — a cow that eats your Codex sessions

${pc.bold("Usage:")}
  dexcow              Interactive picker (multiselect + delete)
  dexcow help         Show this help
  dexcow ls           List all sessions
  dexcow rm <id...>   Delete specific sessions by id
  dexcow trash        List trashed rollout files
  dexcow trash --empty Empty dexcow trash after confirmation
  dexcow -h, --help   Show this help
  dexcow -v, --version

${pc.bold("Flags:")}
  --hard              Delete rollout files instead of moving them to ${pc.dim("~/.codex/.dexcow-trash")}
  --yes, -y           With trash --empty: skip confirmation

${pc.bold("Data source:")}
  ${pc.dim(paths.stateDb)}
`;

const COMMAND_HELP: Record<string, string> = {
  help: MAIN_HELP,
  ls: `${pc.bold("dexcow ls")}

${pc.bold("Usage:")}
  dexcow ls

List Codex sessions known to the local state database.
`,
  list: `${pc.bold("dexcow ls")}

${pc.bold("Usage:")}
  dexcow ls

List Codex sessions known to the local state database.
`,
  rm: `${pc.bold("dexcow rm")}

${pc.bold("Usage:")}
  dexcow rm <id...> [--hard]

Delete specific sessions by id. By default, rollout files move to trash.
Use --hard to permanently delete rollout files instead.
`,
  delete: `${pc.bold("dexcow rm")}

${pc.bold("Usage:")}
  dexcow rm <id...> [--hard]

Delete specific sessions by id. By default, rollout files move to trash.
Use --hard to permanently delete rollout files instead.
`,
  trash: `${pc.bold("dexcow trash")}

${pc.bold("Usage:")}
  dexcow trash
  dexcow trash --empty
  dexcow trash --empty --yes

List trashed rollout files, or empty dexcow trash after confirmation.
Use --yes to skip confirmation in scripts.
`,
};

export function helpFor(command?: string): string {
  if (!command) return MAIN_HELP;
  return COMMAND_HELP[command] ?? MAIN_HELP;
}
