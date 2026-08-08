import { expect, test } from "bun:test";
import { parseArgs } from "../src/args.ts";

test("parseArgs separates command positionals from flags", () => {
  const parsed = parseArgs(["rm", "thread-1", "--confirm"]);

  expect(parsed.command).toBe("rm");
  expect(parsed.commandPositionals).toEqual(["thread-1"]);
});

test("parseArgs supports global help before a command", () => {
  const parsed = parseArgs(["--help", "rm", "thread-1"]);

  expect(parsed.command).toBe("rm");
  expect(parsed.commandPositionals).toEqual(["thread-1"]);
  expect(parsed.help).toBe(true);
});

test("parseArgs recognizes the archived session scope", () => {
  const parsed = parseArgs(["ls", "--archived"]);
  expect(parsed.archived).toBe(true);
});

test("parseArgs recognizes explicit deletion confirmation", () => {
  expect(parseArgs(["rm", "thread-1", "--yes"]).yes).toBe(true);
  expect(parseArgs(["rm", "thread-1", "-y"]).yes).toBe(true);
});
