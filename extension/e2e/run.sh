#!/usr/bin/env bash
# Builds the extension, publishes a fixture database as static job data, runs the browser tests, cleans up.
#   npm run e2e            -> the full suite
#   npm run e2e:screens    -> regenerate screenshots / store assets
set -euo pipefail
cd "$(dirname "$0")/.."                      # extension/
ROOT="$(cd .. && pwd)"
PY="${PYTHON:-$ROOT/.venv/bin/python}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
export DATABASE_PATH="$WORK/e2e.db" SNAPSHOT_REPO="" RATE_LIMIT_PER_MIN=0 RATE_LIMIT_WRITES_PER_MIN=0 RATE_LIMIT_SYNC_PER_MIN=0 AUTO_SYNC_INTERVAL_HOURS=999

# Build into the system temp dir: macOS blocks a background-launched Chromium from reading ~/Downloads, ~/Documents etc.
export EXT_DIST="$WORK/build/dev" EXT_PROD="$WORK/build/prod"
npx vite build --mode development --outDir "$EXT_DIST" --emptyOutDir >/dev/null
npx vite build --outDir "$EXT_PROD" --emptyOutDir >/dev/null
"$PY" e2e/fixture.py
export STATIC_DIR="$WORK/static"
( cd "$ROOT" && "$PY" -m backend.app.static_export "$STATIC_DIR" >/dev/null )
node "e2e/${1:-suite}.mjs"
