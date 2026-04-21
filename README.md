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
dexcow --hard       # skip trash, purge immediately
```

Deleted sessions move to `~/.codex/.dexcow-trash/<date>/` by default. Use `--hard` to skip the trash.

## What it touches

- Reads & writes `~/.codex/state_5.sqlite` (the `threads` table).
- Moves / deletes rollout files under `~/.codex/sessions/`.
- Leaves `logs_2.sqlite`, `auth.json`, `config.toml`, memories, and skills alone.

Set `CODEX_HOME` to point at a non-default Codex directory.

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
