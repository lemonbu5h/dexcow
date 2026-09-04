# Development

## Run from Source

Install [Bun](https://bun.sh), then:

```bash
git clone https://github.com/lemonbu5h/codex-cow.git
cd codex-cow
bun install
bun run build
bun link
dexcow --version
```

To run directly from source without linking:

```bash
bun run dev
```

## Checks and Builds

```bash
bun run typecheck
bun test
bun run coverage
bun run build
bun run compile
```

`build` bundles the CLI and agent runner. `compile` creates a standalone binary at `dist/dexcow` for the current platform. The bundled agent runner is tracked in Git; rebuild it when shared code changes.

See [Architecture](architecture.md) for module responsibilities and coverage settings, and [Release process](release.md) for publishing.
