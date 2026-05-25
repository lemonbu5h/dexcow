import { expect, test } from "bun:test";
import { parseArgs } from "../src/args.ts";

test("parseArgs keeps flags after the command for command handlers", () => {
  const parsed = parseArgs(["trash", "--empty", "--yes"]);

  expect(parsed.command).toBe("trash");
  expect(parsed.commandArgs).toEqual(["--empty", "--yes"]);
  expect(parsed.commandPositionals).toEqual([]);
});

test("parseArgs keeps rm ids separate from flags", () => {
  const parsed = parseArgs(["rm", "thread-1", "--hard"]);

  expect(parsed.command).toBe("rm");
  expect(parsed.commandArgs).toEqual(["thread-1", "--hard"]);
  expect(parsed.commandPositionals).toEqual(["thread-1"]);
  expect(parsed.hard).toBe(true);
});

test("parseArgs supports global flags before a command", () => {
  const parsed = parseArgs(["--hard", "rm", "thread-1"]);

  expect(parsed.command).toBe("rm");
  expect(parsed.commandPositionals).toEqual(["thread-1"]);
  expect(parsed.hard).toBe(true);
});
