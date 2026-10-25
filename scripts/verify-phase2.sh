#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  for NODE_CANDIDATE in \
    "$HOME"/.local/share/fnm/node-versions/*/installation/bin/node \
    "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$NODE_CANDIDATE" ]; then
      PATH="$(dirname "$NODE_CANDIDATE"):$PATH"
      export PATH
      break
    fi
  done
fi

VERIFY_BUILD_DIR="$(mktemp -d /tmp/psyco-phase2-build-XXXXXX)"
trap 'rm -rf "$VERIFY_BUILD_DIR"' EXIT

./node_modules/.bin/tsc \
  --target ES2020 \
  --module commonjs \
  --moduleResolution node \
  --strict \
  --skipLibCheck \
  --esModuleInterop \
  --outDir "$VERIFY_BUILD_DIR" \
  scripts/verify-phase2.ts types/spec.ts lib/game-engine.ts

node "$VERIFY_BUILD_DIR/scripts/verify-phase2.js"
