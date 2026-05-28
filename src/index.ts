#!/usr/bin/env bun
import { updateSettings } from "@clack/prompts";
import pc from "picocolors";
import { describeStateDbPath } from "./codexStores.ts";
import { parseArgs } from "./args.ts";
import { runInteractive, runList, runRemove, runTrash } from "./commands.ts";
import { helpFor } from "./help.ts";
import { VERSION } from "./version.ts";

updateSettings({
  aliases: {
    q: "cancel",
  },
});

async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv.slice(2));

  if (parsed.help) {
    console.log(helpFor(parsed.command));
    return;
  }
  if (parsed.version) {
    console.log(VERSION);
    return;
  }

  try {
    // Commands stay thin here; state access and destructive operations live in focused modules.
    switch (parsed.command) {
      case undefined:
        await runInteractive({ hard: parsed.hard });
        return;
      case "help":
        console.log(helpFor(parsed.commandPositionals[0]));
        return;
      case "ls":
      case "list":
        await runList();
        return;
      case "rm":
      case "delete":
        await runRemove(parsed.commandPositionals, { hard: parsed.hard });
        return;
      case "trash":
        await runTrash(parsed.commandArgs);
        return;
      default:
        console.error(pc.red(`unknown command: ${parsed.command}`));
        console.error(helpFor());
        process.exit(2);
    }
  } catch (err) {
    if (isMissingDb(err)) {
      console.error(pc.red("Codex state database not found:"), describeStateDbPath());
      console.error(pc.dim("Is Codex installed? Set CODEX_HOME to override."));
      process.exit(1);
    }
    throw err;
  }
}

function isMissingDb(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Codex state database not found") || msg.includes("unable to open") || msg.includes("ENOENT");
}

await main(process.argv);
