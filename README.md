# dexcow

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
dexcow ls           # list sessions
dexcow rm <id>...   # remove by id
dexcow --hard       # delete rollout files instead of moving them to trash
dexcow --version
```

By default, rollout files move to `~/.codex/.dexcow-trash/<date>/`. `--hard` skips that trash step.

The interactive picker shows repository names instead of full working-directory paths. Press space to select sessions, then enter to review the selected sessions and confirm.

## Safety

`dexcow` removes local Codex session records, logs, index entries, and rollout files for the sessions you choose.

It does not touch `auth.json`, `config.toml`, memories, or skills.

Set `CODEX_HOME` to point at a non-default Codex directory.

## Development

```bash
bun install
bun run dev
bun run typecheck
bun test
bun run build
bun run compile
```

More detail:

- [Architecture](docs/architecture.md)
- [Release process](docs/release.md)

## License

MIT. See [LICENSE](./LICENSE).
