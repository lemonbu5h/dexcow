#!/usr/bin/env bun
import pc from "picocolors";
import { paths } from "./paths.ts";
import { runInteractive, runList, runRemove, runTrash } from "./commands.ts";
import { VERSION } from "./version.ts";

const HELP = `${pc.bold("dexcow")} — a cow that eats your Codex sessions

${pc.bold("Usage:")}
  dexcow              Interactive picker (multiselect + delete)
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

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    return;
  }
  if (args.includes("-v") || args.includes("--version")) {
    console.log(VERSION);
    return;
  }

  const hard = args.includes("--hard");
  const positional = args.filter((a) => !a.startsWith("-"));
  const [command, ...rest] = positional;

  try {
    // Commands stay thin here; state access and destructive operations live in focused modules.
    switch (command) {
      case undefined:
        await runInteractive({ hard });
        return;
      case "ls":
      case "list":
        await runList();
        return;
      case "rm":
      case "delete":
        await runRemove(rest, { hard });
        return;
      case "trash":
        await runTrash(rest);
        return;
      default:
        console.error(pc.red(`unknown command: ${command}`));
        console.error(HELP);
        process.exit(2);
    }
  } catch (err) {
    if (isMissingDb(err)) {
      console.error(pc.red("Codex state database not found:"), paths.stateDb);
      console.error(pc.dim("Is Codex installed? Set CODEX_HOME to override."));
      process.exit(1);
    }
    throw err;
  }
}

function isMissingDb(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("unable to open") || msg.includes("ENOENT");
}

await main(process.argv);
