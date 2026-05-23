# dexcow 🐄

A cow that eats your Codex sessions.

Codex doesn't let you delete sessions from its GUI. `dexcow` is a tiny terminal tool that reads Codex's own session index and lets you pick sessions to remove — interactively, with titles that match what you see in Codex.

## Install

```bash
bun install -g dexcow
# or, from source:
git clone git@github.com:lemonbu5h/dexcow.git && cd dexcow
bun install && bun link
```

## Use

```bash
dexcow              # interactive multiselect
dexcow ls           # list sessions (pipeable)
dexcow rm <id>...   # delete by id
dexcow --version    # print SemVer package version
dexcow --hard       # skip trash, purge immediately
```

Deleted sessions move to `~/.codex/.dexcow-trash/<date>/` by default. Use `--hard` to skip the trash.

## Flow

### Command map

```mermaid
flowchart LR
  A["dexcow"] --> B["interactive delete"]
  A --> C["ls"]
  A --> D["rm <id...>"]
  A --> E["--version"]
```

### Interactive delete

Related files: `src/index.ts`, `src/commands.ts`, `src/threads.ts`, `src/sessionIndex.ts`, `src/trash.ts`.

```mermaid
flowchart TD
  A["Open Codex state DB"] --> B["Load threads"]
  B --> C["Resolve display titles"]
  C --> D["Prompt for sessions"]
  D --> E{"Confirmed?"}
  E -->|"no"| F["Exit without changes"]
  E -->|"yes"| G{"--hard?"}
  G -->|"no"| H["Move rollout files to trash"]
  G -->|"yes"| I["Delete rollout files"]
  H --> J["Delete thread rows"]
  I --> J
  J --> K["Print summary"]
```

### List sessions

Related files: `src/index.ts`, `src/commands.ts`, `src/threads.ts`, `src/sessionIndex.ts`, `src/format.ts`.

```mermaid
flowchart TD
  A["Open Codex state DB"] --> B["Load threads"]
  B --> C["Resolve newest session-index titles"]
  C --> D["Format age, status, title, cwd"]
  D --> E["Print rows to stdout"]
```

### Remove by id

Related files: `src/index.ts`, `src/commands.ts`, `src/threads.ts`, `src/trash.ts`.

```mermaid
flowchart TD
  A["Open Codex state DB"] --> B["Load threads"]
  B --> C["Match requested ids"]
  C --> D{"--hard?"}
  D -->|"no"| E["Move matched rollout files to trash"]
  D -->|"yes"| F["Delete matched rollout files"]
  E --> G["Delete matched thread rows"]
  F --> G
  G --> H["Print summary"]
```

### Version

Related files: `src/index.ts`, `src/version.ts`, `package.json`.

```mermaid
flowchart TD
  A["Read package.json version"] --> B["Print SemVer"]
```

## Versioning

`dexcow` uses the SemVer-compatible `version` field in `package.json` as its release version:

```bash
$ dexcow --version
0.1.0
```

Release bumps should update `package.json`; the CLI reads from that single source of truth.

## What it touches

- Reads & writes `~/.codex/state_5.sqlite` (the `threads` table).
- Moves / deletes rollout files under `~/.codex/sessions/`.
- Leaves `logs_2.sqlite`, `auth.json`, `config.toml`, memories, and skills alone.

Set `CODEX_HOME` to point at a non-default Codex directory.

## TODO: full purge

Current delete behavior removes the `threads` row and moves or deletes the rollout file. A future full purge should explicitly remove all local Codex records tied to the thread id:

- `state_5.sqlite`: `threads`, `thread_dynamic_tools`, `thread_spawn_edges`, `stage1_outputs`, and `agent_job_items.assigned_thread_id`.
- `logs_2.sqlite`: `logs` rows with the deleted `thread_id`.
- `session_index.jsonl`: historical title entries for the deleted thread.
- Any future Codex tables or sidecar files that add a direct thread-id reference.

## Dev

```bash
bun install
bun run dev                 # run from source
bun run typecheck
bun run build               # bundle to dist/dexcow.js
bun run compile             # standalone binary dist/dexcow
```

## License

MIT
