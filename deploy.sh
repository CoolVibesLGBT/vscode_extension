#!/usr/bin/env bash
set -euo pipefail

# Build the current web workspace into an installable VS Code extension.
# Usage: ./deploy.sh [/absolute/path/to/web]
# Or: COOLVIBES_WEB_ROOT=/absolute/path/to/web ./deploy.sh
extension_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$extension_root"

publish=false
web_source=''
for argument in "$@"; do
  case "$argument" in
    --publish) publish=true ;;
    --help|-h)
      printf 'Usage: %s [--publish] [/absolute/path/to/web]\n' "$0"
      exit 0 ;;
    --*) printf 'Unknown option: %s\n' "$argument" >&2; exit 1 ;;
    *)
      if [[ -n "$web_source" ]]; then
        printf 'Only one web source path is accepted.\n' >&2
        exit 1
      fi
      web_source="$argument" ;;
  esac
done
if [[ -n "$web_source" ]]; then
  export COOLVIBES_WEB_ROOT="$web_source"
fi
if [[ -n "${COOLVIBES_WEB_ROOT:-}" ]]; then
  export COOLVIBES_WEB_ROOT="$(cd -- "$COOLVIBES_WEB_ROOT" && pwd)"
fi

command -v node >/dev/null || { printf 'Node.js is required.\n' >&2; exit 1; }
command -v yarn >/dev/null || { printf 'Yarn is required.\n' >&2; exit 1; }
if [[ ! -x node_modules/.bin/vsce ]]; then
  yarn install --frozen-lockfile
fi

if [[ "$publish" == true ]]; then
  node ./scripts/publish-marketplace.cjs --check-auth
  export COOLVIBES_PUBLISH_LOGIN=0
fi

# The prepublish hook checks the extension, builds directly from the web
# workspace, synchronizes brand icons, and validates bundled asset paths.
yarn run package:vsix
node -e 'const path = require("node:path"); const p = require("./package.json"); console.log("\nVSIX ready: " + path.resolve(`${p.name}-${p.version}.vsix`));'

if [[ "$publish" == true ]]; then
  package_path="$(node -p 'const p = require("./package.json"); `${p.name}-${p.version}.vsix`')"
  node ./scripts/publish-marketplace.cjs "$package_path"
fi
