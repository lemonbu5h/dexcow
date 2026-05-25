#!/usr/bin/env bun
import pc from "picocolors";
import { paths } from "./paths.ts";
import { runInteractive, runList, runRemove, runTrash } from "./commands.ts";
import { helpFor } from "./help.ts";
import { VERSION } from "./version.ts";

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    console.log(helpFor(firstCommand(args)));
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
      case "help":
        console.log(helpFor(rest[0]));
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
        console.error(helpFor());
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

function firstCommand(args: string[]): string | undefined {
  return args.find((arg) => !arg.startsWith("-"));
}

await main(process.argv);
