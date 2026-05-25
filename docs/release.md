# Release Process

## Checklist

1. Update `package.json` version.
2. Run local checks:

   ```bash
   bun run typecheck
   bun test
   bun run build
   bun run compile
   ```

3. Commit and merge the version bump.
4. Check out the updated `main`. Do not tag the release branch before merge; the tag should point at the final commit users install.
5. Tag the release from `main`:

   ```bash
   git tag -a v0.1.1 -m "release: v0.1.1"
   git push origin v0.1.1
   ```

6. Confirm the GitHub Release has these assets:

   - `dexcow-macos-arm64`
   - `dexcow-linux-x64`

7. Verify the install script:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/lemonbu5h/dexcow/main/install.sh | sh
   dexcow --version
   ```

## Notes

- GitHub Releases are the preferred install path for users who do not have Bun.
- `bun install -g dexcow` should only be documented as a normal install path after publishing to npm.
- `install.sh` downloads from the latest GitHub Release by default.
