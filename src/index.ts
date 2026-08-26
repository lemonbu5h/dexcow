#!/usr/bin/env bun
import { updateSettings } from "@clack/prompts";
import pc from "picocolors";
import {
  CodexStoreNotFoundError,
  CodexStoreSchemaError,
  CodexStoreUnavailableError,
} from "./codexStores.ts";
import { parseArgs } from "./args.ts";
import { runInteractive, runList, runRemove } from "./commands.ts";
import { helpFor } from "./help.ts";
import { ThreadsLockedError } from "./sessionArtifacts.ts";
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
        await runInteractive();
        return;
      case "help":
        console.log(helpFor(parsed.commandPositionals[0]));
        return;
      case "ls":
      case "list":
        await runList(parsed.archived ? "archived" : "active");
        return;
      case "archived":
        await runInteractive("archived");
        return;
      case "rm":
      case "delete":
        await runRemove(parsed.commandPositionals, parsed.yes);
        return;
      default:
        console.error(pc.red(`unknown command: ${parsed.command}`));
        console.error(helpFor());
        process.exit(2);
    }
  } catch (err) {
    if (err instanceof ThreadsLockedError) {
      const count = err.threadIds.length;
      const noun = count === 1 ? "session" : "sessions";
      console.error(pc.yellow(`Cannot delete ${count} ${noun}; Codex is still using ${count === 1 ? "it" : "them"}.`));
      console.error(pc.dim("Close the active task in Codex and try again. No changes were made."));
      process.exitCode = 1;
      return;
    }
    if (err instanceof CodexStoreUnavailableError) {
      console.error(pc.yellow("Codex state database is temporarily unavailable:"), err.path);
      console.error(pc.dim("Codex may be updating it. Wait a moment, then try again."));
      process.exitCode = 1;
      return;
    }
    if (err instanceof CodexStoreSchemaError) {
      console.error(pc.yellow("This Codex storage format is not supported yet:"), err.path);
      console.error(pc.dim(`Missing expected fields: ${err.missingColumns.join(", ")}`));
      console.error(pc.dim("Update dexcow after Codex changes its local database schema."));
      process.exitCode = 1;
      return;
    }
    if (err instanceof CodexStoreNotFoundError) {
      console.error(pc.red("Codex state database not found:"), err.path);
      console.error(pc.dim("Is Codex installed? Set CODEX_HOME to override."));
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

await main(process.argv);
