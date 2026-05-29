# dexcow

[![CI](https://github.com/lemonbu5h/dexcow/actions/workflows/ci.yml/badge.svg)](https://github.com/lemonbu5h/dexcow/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/lemonbu5h/dexcow/branch/main/graph/badge.svg)](https://codecov.io/gh/lemonbu5h/dexcow)
[![Release](https://github.com/lemonbu5h/dexcow/actions/workflows/release.yml/badge.svg)](https://github.com/lemonbu5h/dexcow/actions/workflows/release.yml)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black?logo=bun)](https://bun.sh)

A tiny CLI for cleaning up local Codex sessions.

Codex does not currently expose session deletion in the GUI. `dexcow` reads Codex's local session index, lets you pick sessions by title/repo, and purges the selected local session state.

## Install

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

`bun install -g dexcow` will work after the package is published to npm.

## Use

```bash
dexcow              # interactive picker
dexcow help         # list commands
dexcow ls           # list sessions
dexcow rm <id>...   # remove by id
dexcow trash        # list trashed rollout files
dexcow trash --empty # empty trash after confirmation
dexcow --hard       # delete rollout files instead of moving them to trash
dexcow --version
```

By default, rollout files move to `~/.codex/.dexcow-trash/<date>/`. `--hard` skips that trash step.

The interactive picker shows repository names instead of full working-directory paths. Press space to select sessions, then enter to review the selected sessions and confirm.

After deleting sessions, refresh Codex if the GUI still shows old sessions. Clicking the repo in Codex and collapsing or expanding it usually refreshes the list; restart Codex only if it still looks stale.

## Safety

`dexcow` removes local Codex session records, logs, index entries, and rollout files for the sessions you choose. It discovers Codex's numbered `state_*.sqlite` and `logs_*.sqlite` files by checking their schema, so minor Codex storage filename changes are less likely to break cleanup.

It does not touch `auth.json`, `config.toml`, memories, skills, or `sqlite/codex-dev.db`.

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
