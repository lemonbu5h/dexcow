# Architecture

## Flow

### Command map

```mermaid
flowchart LR
  A["dexcow"] --> B["interactive"]
  A --> C["ls"]
  A --> D["rm <id...>"]
  A --> E["trash"]
  A --> F["--version"]
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

## Purge Scope

`dexcow` removes:

- thread rows from `~/.codex/state_5.sqlite`
- related rows from `thread_dynamic_tools`, `thread_spawn_edges`, and `stage1_outputs` when those tables exist
- `agent_job_items.assigned_thread_id` references when that column exists
- matching `thread_id` rows from `~/.codex/logs_2.sqlite` when the logs database exists
- matching entries from `~/.codex/session_index.jsonl`
- rollout files under `~/.codex/sessions/`

It leaves `auth.json`, `config.toml`, memories, and skills alone.

## Trash

Related files: `src/index.ts`, `src/commands.ts`, `src/trash.ts`.

```mermaid
flowchart LR
  A["trash"] --> B["Inspect .dexcow-trash"]
  B --> C["Print buckets"]
  A2["trash --empty"] --> B2["Inspect .dexcow-trash"]
  B2 --> C2["Confirm"]
  C2 --> D2["Delete .dexcow-trash"]
```
