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
5. Configure Git to sign tags with a signing key registered in GitHub. For SSH signing:

   ```bash
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/id_ed25519.pub
   git config --global tag.gpgSign true
   ```

6. Create and push the signed tag from `main`:

   ```bash
   git tag -s v0.2.0 -m "release: v0.2.0"
   git push origin v0.2.0
   ```

7. Confirm the tag shows as Verified on GitHub and the GitHub Release has these assets:

   - `dexcow-macos-arm64`
   - `dexcow-linux-x64`

8. Verify the install script:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/lemonbu5h/dexcow/main/install.sh | sh
   dexcow --version
   ```

## Notes

- GitHub Releases are the preferred install path for users who do not have Bun.
- A tag is only shown as Verified when it is signed and its public signing key is registered with GitHub.
- `bun install -g dexcow` should only be documented as a normal install path after publishing to npm.
- `install.sh` downloads from the latest GitHub Release by default.
