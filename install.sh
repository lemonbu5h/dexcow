#!/bin/sh
set -eu

REPO="lemonbu5h/dexcow"
VERSION="${DEXCOW_VERSION:-latest}"
INSTALL_DIR="${DEXCOW_INSTALL_DIR:-}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "dexcow install: missing required command: $1" >&2
    exit 1
  fi
}

detect_asset() {
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os:$arch" in
    Darwin:arm64)
      echo "dexcow-macos-arm64"
      ;;
    Linux:x86_64|Linux:amd64)
      echo "dexcow-linux-x64"
      ;;
    *)
      echo "dexcow install: unsupported platform: $os $arch" >&2
      echo "Download a release manually from https://github.com/$REPO/releases" >&2
      exit 1
      ;;
  esac
}

choose_install_dir() {
  if [ -n "$INSTALL_DIR" ]; then
    echo "$INSTALL_DIR"
  elif [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
    echo "/usr/local/bin"
  else
    echo "$HOME/.local/bin"
  fi
}

download() {
  url="$1"
  dest="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$dest"
  else
    echo "dexcow install: install curl or wget first" >&2
    exit 1
  fi
}

need uname
need chmod
need mkdir
need mv

asset="$(detect_asset)"
target_dir="$(choose_install_dir)"
tmp_dir="${TMPDIR:-/tmp}/dexcow-install.$$"
tmp_bin="$tmp_dir/dexcow"

if [ "$VERSION" = "latest" ]; then
  url="https://github.com/$REPO/releases/latest/download/$asset"
else
  url="https://github.com/$REPO/releases/download/$VERSION/$asset"
fi

mkdir -p "$tmp_dir"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

echo "Downloading $asset..."
download "$url" "$tmp_bin"
chmod +x "$tmp_bin"

mkdir -p "$target_dir"
mv "$tmp_bin" "$target_dir/dexcow"

echo "Installed dexcow to $target_dir/dexcow"
"$target_dir/dexcow" --version

case ":$PATH:" in
  *":$target_dir:"*)
    ;;
  *)
    echo "Add $target_dir to PATH to run dexcow from any directory."
    ;;
esac
