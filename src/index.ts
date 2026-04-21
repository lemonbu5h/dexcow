#!/usr/bin/env bun
import pc from "picocolors";
import { paths } from "./paths.ts";
import { runInteractive, runList, runRemove } from "./commands.ts";

const VERSION = "0.1.0";

const HELP = `${pc.bold("dexcow")} — a cow that eats your Codex sessions

${pc.bold("Usage:")}
  dexcow              Interactive picker (multiselect + delete)
  dexcow ls           List all sessions
  dexcow rm <id...>   Delete specific sessions by id
  dexcow -h, --help   Show this help
  dexcow -v, --version

${pc.bold("Flags:")}
  --hard              Permanently delete (skip trash at ${pc.dim("~/.codex/.dexcow-trash")})

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
