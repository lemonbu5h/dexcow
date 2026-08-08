# dexcow

**Clean up local Codex sessions with an agent skill or an interactive terminal UI.**

Use the included agent skill for a guided cleanup, or the standalone TUI for a visible, deterministic selection flow. Both use the same local-first cleanup core and permanently delete only the sessions you explicitly select.

[![CI](https://github.com/lemonbu5h/dexcow/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonbu5h/dexcow/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/lemonbu5h/dexcow/branch/main/graph/badge.svg)](https://codecov.io/gh/lemonbu5h/dexcow)
[![Release](https://github.com/lemonbu5h/dexcow/actions/workflows/release.yml/badge.svg)](https://github.com/lemonbu5h/dexcow/actions/workflows/release.yml)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black?logo=bun)](https://bun.sh)

Codex does not currently expose session deletion in the GUI. `dexcow` reads the local session index, lets you inspect sessions by title and repo, then cleans up the selected local state.

## Demo

<p>
  <img src="docs/assets/dexcow-repo-picker.svg" alt="dexcow repo picker showing demo repositories" width="920">
</p>

<p>
  <img src="docs/assets/dexcow-session-picker.svg" alt="dexcow session picker showing demo sessions" width="920">
</p>

## Quick Start

### Ask Your Agent

Install [`skills/dexcow`](skills/dexcow) in your agent's skills directory. For Codex, copy it to `~/.codex/skills/dexcow`, then ask:

```text
Use $dexcow to review my local Codex sessions and help me safely remove the ones I choose.
```

The skill bundles its own structured agent runner. It requires Bun, but it does not require the `dexcow` CLI/TUI to be installed.

### Use the Interactive TUI

Recommended:

```bash
curl -fsSL https://raw.githubusercontent.com/lemonbu5h/dexcow/main/install.sh | sh
```

This downloads the right GitHub Release binary for your platform when one is available. Bun is not required for the standalone binary.

Manual downloads:

- macOS Apple Silicon: `dexcow-macos-arm64`
- Linux x64: `dexcow-linux-x64`

From source:

```bash
git clone git@github.com:lemonbu5h/dexcow.git
cd dexcow
bun install
bun run build
bun link
```

## Commands

```bash
dexcow              # interactive picker
dexcow help         # list commands
dexcow ls           # list sessions shown in Codex
dexcow archived     # clean up archived sessions
dexcow ls --archived # list archived sessions
dexcow rm <id>...   # permanently delete by id
dexcow --version
```

The default picker mirrors Codex by showing active sessions only. Sessions from temporary Codex worktrees are grouped with their real repository using Git origin, so worktree prefixes do not create duplicate repo entries. Use `dexcow archived` for sessions Codex has hidden from its normal sidebar. A session appears under **Unlinked sessions** only when no Git repository identity is available.

Press space to select sessions, then enter to review the selected sessions and confirm permanent deletion.

Dexcow refuses to delete a session while Codex has a current writer lock for it. Close that active task first, then run the cleanup again.

After deleting sessions, refresh Codex if the GUI still shows old sessions. Clicking the repo in Codex and collapsing or expanding it usually refreshes the list; restart Codex only if it still looks stale.

## Safety

`dexcow` removes local Codex session records, logs, index entries, Desktop catalog/history rows, shell snapshots, and rollout files for the sessions you choose. It handles both active rollouts in `sessions/` and archived rollouts in `archived_sessions/`.

Codex's local storage format is private and changes quickly. Dexcow intentionally targets the current `state_5.sqlite`, `logs_2.sqlite`, `session_index.jsonl`, and Desktop SQLite schemas instead of carrying compatibility code for older layouts. Rollout JSONL contents are never parsed; only the current three-field session index is read and rewritten.

It does not touch `auth.json`, `config.toml`, memories, goals, skills, attachments, worktrees, global UI state, or automation definitions.

Set `CODEX_HOME` to point at a non-default Codex directory.

## Development

```bash
bun install
bun run dev
bun run typecheck
bun test
bun run coverage
bun run build
bun run compile
```

More detail:

- [Architecture](docs/architecture.md)
- [Release process](docs/release.md)

## License

MIT. See [LICENSE](./LICENSE).
