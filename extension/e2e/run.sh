#!/usr/bin/env bash
# Builds the extension, starts a backend on a fixture database, runs the browser tests, cleans up.
#   npm run e2e            -> the full suite
#   npm run e2e:screens    -> regenerate screenshots / store assets
set -euo pipefail
cd "$(dirname "$0")/.."                      # extension/
ROOT="$(cd .. && pwd)"
PY="${PYTHON:-$ROOT/.venv/bin/python}"
WORK="$(mktemp -d)"; trap 'kill "${SERVER:-0}" 2>/dev/null || true; rm -rf "$WORK"' EXIT
export DATABASE_PATH="$WORK/e2e.db" SNAPSHOT_REPO="" RATE_LIMIT_PER_MIN=0 RATE_LIMIT_WRITES_PER_MIN=0 RATE_LIMIT_SYNC_PER_MIN=0 AUTO_SYNC_INTERVAL_HOURS=999

# Build into the system temp dir: macOS blocks a background-launched Chromium from reading ~/Downloads, ~/Documents etc.
export EXT_DIST="$WORK/build/dev" EXT_PROD="$WORK/build/prod"
npx vite build --mode development --outDir "$EXT_DIST" --emptyOutDir >/dev/null
npx vite build --outDir "$EXT_PROD" --emptyOutDir >/dev/null
"$PY" e2e/fixture.py
export STATIC_DIR="$WORK/static"
( cd "$ROOT" && "$PY" -m backend.app.static_export "$STATIC_DIR" >/dev/null )
if lsof -i :8000 -sTCP:LISTEN >/dev/null 2>&1; then echo "Port 8000 is busy: stop whatever is using it first" >&2; exit 1; fi
( cd "$ROOT" && exec "$PY" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --log-level warning ) & SERVER=$!   # exec: SERVER is the python process itself
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:8000/health >/dev/null && break; sleep 1; done
node "e2e/${1:-suite}.mjs"
