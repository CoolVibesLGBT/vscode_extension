#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname -- "${BASH_SOURCE[0]}")"

# Retain a local recovery branch, then rebuild only unpublished commits on top
# of the latest remote main. This preserves working files and needs no force push.
git fetch origin main
git branch "backup/vsix-cleanup-$(date +%Y%m%d-%H%M%S)"
git reset --mixed origin/main
git rm -r --cached --ignore-unmatch node_modules media/webview '*.vsix'
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Update extension, load public media from website and remove build artifacts"
fi
git push --set-upstream origin main
