export interface ParsedArgs {
  command?: string;
  commandPositionals: string[];
  archived: boolean;
  yes: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(args: string[]): ParsedArgs {
  const commandIndex = args.findIndex(isPositional);
  const command = commandIndex >= 0 ? args[commandIndex] : undefined;
  const commandArgs = commandIndex >= 0 ? args.slice(commandIndex + 1) : [];

  return {
    command,
    commandPositionals: commandArgs.filter(isPositional),
    archived: args.includes("--archived"),
    yes: args.includes("--yes") || args.includes("-y"),
    help: args.includes("-h") || args.includes("--help"),
    version: args.includes("-v") || args.includes("--version"),
  };
}

function isPositional(arg: string): boolean {
  return !arg.startsWith("-");
}
