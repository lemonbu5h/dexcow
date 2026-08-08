---
name: dexcow
description: Safely inspect and permanently remove local Codex sessions using the bundled agent runner. Use when a user asks to list, clean up, delete, purge, or recover space from local Codex sessions without using the interactive terminal UI.
---

# Dexcow

Use `bin/dexcow-agent.js` for every operation. It shares dexcow's tested session discovery, purge, and storage handling, but does not require the `dexcow` CLI/TUI to be installed.

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

   If the user explicitly asks to clean up sessions hidden from the normal Codex sidebar, list archived sessions separately:

   ```bash
   bun bin/dexcow-agent.js list --archived
   ```

2. Make the proposed selection explicit. State the session titles and ids, and explain that deletion is permanent.

3. Obtain an explicit confirmation after showing that selection. Never treat an earlier broad request such as "clean up my sessions" as confirmation for a specific set of sessions.

4. Permanently delete the selected sessions.

   ```bash
   bun bin/dexcow-agent.js purge <id...> --confirm
   ```

5. Report the structured result. Tell the user to refresh Codex if old sessions still appear; collapsing and expanding the repo usually refreshes the list.

## Boundaries

- Do not edit Codex SQLite databases, session indexes, or rollout files directly.
- Do not use `rm` for session cleanup.
- Do not touch `auth.json`, `config.toml`, memories, skills, or `sqlite/codex-dev.db`.
- If Bun is unavailable, explain that this independent skill runner needs Bun and offer the standalone `dexcow` TUI as the no-Bun alternative.
