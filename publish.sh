#!/usr/bin/env bash
set -euo pipefail

extension_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$extension_root"

if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then
  printf 'Usage: %s [/absolute/path/to/web]\nBuild, push to GitHub, then publish to Marketplace using your terminal credentials.\n' "$0"
  exit 0
fi
if [[ "$#" -gt 1 || "${1:-}" == --* ]]; then
  printf 'Usage: %s [/absolute/path/to/web]\n' "$0" >&2
  exit 1
fi

# Build before changing anything in the remote repository.
./deploy.sh "$@"
package_path="$(node -p 'const p = require("./package.json"); `${p.name}-${p.version}.vsix`')"
version="$(node -p 'require("./package.json").version')"

# Reuse the terminal's existing Git credential manager and preserve remote history.
checkout="$(mktemp -d "${TMPDIR:-/tmp}/coolvibes-publish.XXXXXX")"
trap 'rm -rf -- "$checkout"' EXIT
git clone https://github.com/CoolVibesLGBT/vscode_extension.git "$checkout/repo"
for file in extension.js package.json yarn.lock README.md CHANGELOG.md deploy.sh publish.sh repair-git.sh .gitignore; do
  cp "$extension_root/$file" "$checkout/repo/$file"
done
for directory in webview scripts media; do
  mkdir -p "$checkout/repo/$directory"
  rsync -a --delete --exclude='.DS_Store' "$extension_root/$directory/" "$checkout/repo/$directory/"
done
chmod +x "$checkout/repo/deploy.sh" "$checkout/repo/publish.sh"
git -C "$checkout/repo" rm -r --cached --ignore-unmatch node_modules media/webview '*.vsix'
git -C "$checkout/repo" add .gitignore repair-git.sh extension.js package.json yarn.lock README.md CHANGELOG.md deploy.sh publish.sh webview scripts media
if ! git -C "$checkout/repo" diff --cached --quiet; then
  git -C "$checkout/repo" commit -m "Update CoolVibes extension to $version with current web app and icon fixes"
fi
git -C "$checkout/repo" push origin HEAD

# Publish the same tested artifact; no second build or version change.
"$extension_root/node_modules/.bin/vsce" publish --packagePath "$extension_root/$package_path"
printf '\nGitHub push and Marketplace publication completed for %s.\n' "$version"
