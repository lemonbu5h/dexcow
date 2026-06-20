---
name: dexcow
description: Safely inspect and remove local Codex sessions using the bundled agent runner. Use when a user asks to list, clean up, trash, permanently purge, or recover space from local Codex sessions without using the interactive terminal UI.
---

# Dexcow

Use `bin/dexcow-agent.js` for every operation. It shares dexcow's tested session discovery, purge, trash, and storage handling, but does not require the `dexcow` CLI/TUI to be installed.

Run the bundled runner with Bun from this skill directory:

```bash
bun bin/dexcow-agent.js <command>
```

## Workflow

1. Inspect before changing anything.

   ```bash
   bun bin/dexcow-agent.js list
   ```

   Summarize the relevant repositories and sessions. Do not expose rollout paths unless the user asks.

2. Make the proposed selection explicit. State the session titles, ids, and whether the default trash flow or permanent purge will be used.

3. Obtain an explicit confirmation after showing that selection. Never treat an earlier broad request such as "clean up my sessions" as confirmation for a specific set of sessions.

4. Move selected sessions to trash by default.

   ```bash
   bun bin/dexcow-agent.js purge <id...> --confirm
   ```

5. Report the structured result, including the trash location when applicable. Tell the user to refresh Codex if old sessions still appear; collapsing and expanding the repo usually refreshes the list.

## Permanent Purge

Use permanent deletion only when the user explicitly asks for it after seeing the selected sessions. Ask for a separate confirmation that the rollout files will bypass trash, then run:

```bash
bun bin/dexcow-agent.js purge <id...> --hard --confirm --confirm-hard
```

## Trash

Inspect trash with:

```bash
bun bin/dexcow-agent.js trash
```

Show the file count and size before offering to empty it. After explicit confirmation, run:

```bash
bun bin/dexcow-agent.js trash --empty --confirm
```

## Boundaries

- Do not edit Codex SQLite databases, session indexes, or rollout files directly.
- Do not use `rm` for session cleanup.
- Do not touch `auth.json`, `config.toml`, memories, skills, or `sqlite/codex-dev.db`.
- If Bun is unavailable, explain that this independent skill runner needs Bun and offer the standalone `dexcow` TUI as the no-Bun alternative.
