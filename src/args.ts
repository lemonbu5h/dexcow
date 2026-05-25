export interface ParsedArgs {
  command?: string;
  commandArgs: string[];
  commandPositionals: string[];
  hard: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(args: string[]): ParsedArgs {
  const commandIndex = args.findIndex(isPositional);
  const command = commandIndex >= 0 ? args[commandIndex] : undefined;
  const commandArgs = commandIndex >= 0 ? args.slice(commandIndex + 1) : [];

  return {
    command,
    commandArgs,
    commandPositionals: commandArgs.filter(isPositional),
    hard: args.includes("--hard"),
    help: args.includes("-h") || args.includes("--help"),
    version: args.includes("-v") || args.includes("--version"),
  };
}

function isPositional(arg: string): boolean {
  return !arg.startsWith("-");
}
