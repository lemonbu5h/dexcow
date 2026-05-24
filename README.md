# dexcow 🐄

A cow that eats your Codex sessions.

Codex doesn't let you delete sessions from its GUI. `dexcow` is a tiny terminal tool that reads Codex's own session index and lets you pick sessions to remove — interactively, with titles that match what you see in Codex.

## Install

### Option 1: standalone binary

Use a standalone binary from GitHub Releases when available. This is the easiest path because it does not require Bun at runtime.

macOS Apple Silicon:

```bash
curl -L https://github.com/lemonbu5h/dexcow/releases/latest/download/dexcow-macos-arm64 -o dexcow
chmod +x dexcow
./dexcow --version
```

Linux x64:

```bash
curl -L https://github.com/lemonbu5h/dexcow/releases/latest/download/dexcow-linux-x64 -o dexcow
chmod +x dexcow
./dexcow --version
```

Move the binary somewhere on your `PATH` if you want to run `dexcow` from any directory.

### Option 2: Bun global install

Use this if you already have Bun installed:

```bash
bun install -g dexcow
```

If `bun` is not installed, install it first from the official Bun docs:

```bash
curl -fsSL https://bun.com/install | bash
bun --version
```

### Option 3: from source

Use this for local development or testing unreleased changes:

```bash
git clone git@github.com:lemonbu5h/dexcow.git && cd dexcow
bun install && bun link
```

## Requirements

- Codex must be installed and have local session state.
- Bun `>=1.1.0` is required for source installs and `bun install -g`.
- Standalone binaries do not require Bun at runtime.

## Use

```bash
dexcow              # interactive multiselect
dexcow ls           # list sessions (pipeable)
dexcow rm <id>...   # delete by id
dexcow --version    # print SemVer package version
dexcow --hard       # skip trash, purge immediately
```

Deleted sessions are purged from Codex's local indexes and logs. Rollout files move to `~/.codex/.dexcow-trash/<date>/` by default; use `--hard` to delete those rollout files immediately.

The interactive picker shows repository names instead of full working-directory paths. Press space to select sessions, then enter to review the selected sessions and confirm.

## Flow

### Command map

```mermaid
flowchart LR
  A["dexcow"] --> B["interactive"]
  A --> C["ls"]
  A --> D["rm <id...>"]
  A --> E["--version"]
```

### Interactive delete

Related files: `src/index.ts`, `src/commands.ts`, `src/purge.ts`, `src/threads.ts`, `src/sessionIndex.ts`, `src/trash.ts`.

```mermaid
flowchart LR
  A["Open DB"] --> B["Load sessions"]
  B --> C["Pick + confirm"]
  C --> D["Move/delete rollout files"]
  D --> E["Purge state, logs, index"]
  E --> F["Summary"]
```

### List sessions

Related files: `src/index.ts`, `src/commands.ts`, `src/threads.ts`, `src/sessionIndex.ts`, `src/format.ts`.

```mermaid
flowchart LR
  A["Open DB"] --> B["Load sessions"]
  B --> C["Resolve titles"]
  C --> D["Format rows"]
  D --> E["Print"]
```

### Remove by id

Related files: `src/index.ts`, `src/commands.ts`, `src/purge.ts`, `src/threads.ts`, `src/sessionIndex.ts`, `src/trash.ts`.

```mermaid
flowchart LR
  A["Open DB"] --> B["Load sessions"]
  B --> C["Match ids"]
  C --> D["Move/delete rollout files"]
  D --> E["Purge state, logs, index"]
  E --> F["Summary"]
```

### Version

Related files: `src/index.ts`, `src/version.ts`, `package.json`.

```mermaid
flowchart LR
  A["Read package.json version"] --> B["Print SemVer"]
```

## Versioning

`dexcow` uses the SemVer-compatible `version` field in `package.json` as its release version:

```bash
$ dexcow --version
0.1.0
```

Release bumps should update `package.json`; the CLI reads from that single source of truth.

## What it purges

- Removes thread rows from `~/.codex/state_5.sqlite`.
- Removes related rows from `thread_dynamic_tools`, `thread_spawn_edges`, and `stage1_outputs` when those tables exist.
- Clears `agent_job_items.assigned_thread_id` when that column exists.
- Removes matching `thread_id` rows from `~/.codex/logs_2.sqlite` when the logs database exists.
- Removes matching entries from `~/.codex/session_index.jsonl`.
- Moves or deletes rollout files under `~/.codex/sessions/`.
- Leaves `auth.json`, `config.toml`, memories, and skills alone.

Set `CODEX_HOME` to point at a non-default Codex directory.

## Dev

```bash
bun install
bun run dev                 # run from source
bun run typecheck
bun test
bun run build               # bundle to dist/dexcow.js
bun run compile             # standalone binary dist/dexcow
```

## Release checklist

1. Update `package.json` version.
2. Run `bun run typecheck`, `bun test`, and `bun run build`.
3. Run `bun run compile` for the local platform.
4. Attach compiled binaries to a GitHub Release.
5. Verify the release binary with `dexcow --version`.

## License

MIT. See [LICENSE](./LICENSE).
