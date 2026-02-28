#!/usr/bin/env bash
set -euo pipefail

# Diagnose common "dev server looks hung" issues for the Node monorepo stack.
# Non-destructive: never kills processes; only collects evidence + runs safe build steps.

ROOT_DIR_DEFAULT="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." >/dev/null 2>&1
  pwd -P
)"

ROOT_DIR="$ROOT_DIR_DEFAULT"
if [ "${1:-}" = "--root" ] && [ -n "${2:-}" ]; then
  ROOT_DIR="$(cd -- "$2" >/dev/null 2>&1 && pwd -P)"
  shift 2
fi

TS="$(date +"%Y%m%d-%H%M%S")"
OUT_DIR="$ROOT_DIR/out/debug/$TS"
mkdir -p "$OUT_DIR"

PORTS=(30010 30011 30020 30110 30120)

redact() {
  # Redact obvious secret patterns from logs.
  sed -E \
    -e 's/(DATABASE_URL|JWT_SECRET|SECRET_KEY|SECRET|PASSWORD|PASS|TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY)=([^[:space:]]+)/\1=<redacted>/g' \
    -e 's/(Authorization: Bearer) [A-Za-z0-9._-]+/\1 <redacted>/g' \
    -e 's#postgres(ql)?://[^[:space:]]+#postgres://<redacted>#g' \
    -e 's#mysql://[^[:space:]]+#mysql://<redacted>#g' \
    -e 's#mongodb(\+srv)?://[^[:space:]]+#mongodb://<redacted>#g'
}

note() {
  # Print to console and append to a session log.
  printf '%s\n' "$*" | tee -a "$OUT_DIR/console.log"
}

run_and_log() {
  local name="$1"; shift
  local log="$OUT_DIR/${name}.log"

  note "== RUN: ${name} =="
  note "cmd: $*"

  set +e
  (cd "$ROOT_DIR" && "$@") 2>&1 | redact | tee "$log" >/dev/null
  local rc=${PIPESTATUS[0]}
  set -e

  printf '%s\n' "$rc" >"$OUT_DIR/${name}.exit_code"
  note "== EXIT(${name}): ${rc} =="

  return 0
}

{
  echo "timestamp: $TS"
  echo "root: $ROOT_DIR"
  echo "user: $(whoami)"
  echo "host: $(hostname)"
  echo "uname: $(uname -a)"
  echo "pwd: $(pwd -P)"
  echo
  command -v node >/dev/null 2>&1 && echo "node: $(node -v)" || echo "node: (missing)"
  command -v pnpm >/dev/null 2>&1 && echo "pnpm: $(pnpm -v)" || echo "pnpm: (missing)"
  echo
  if command -v git >/dev/null 2>&1 && [ -d "$ROOT_DIR/.git" ]; then
    echo "git_rev: $(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || true)"
    echo "git_status_porcelain:"
    git -C "$ROOT_DIR" status --porcelain=v1 2>/dev/null || true
  fi
} >"$OUT_DIR/meta.txt"

# Full process list (useful for spotting zombie dev servers).
ps -ax -o pid=,ppid=,user=,start=,time=,command= >"$OUT_DIR/ps.txt" || true

# Port listeners.
{
  for p in "${PORTS[@]}"; do
    echo "## LISTEN $p"
    lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null || true
    echo
  done
} >"$OUT_DIR/ports.txt"

# Basic env file presence checks (do NOT print values).
{
  for f in \
    "$ROOT_DIR/apps/api/.env" \
    "$ROOT_DIR/apps/api/.env.example" \
    "$ROOT_DIR/apps/web/.env" \
    "$ROOT_DIR/apps/web/.env.example" \
    "$ROOT_DIR/apps/admin/.env" \
    "$ROOT_DIR/apps/admin/.env.example"; do
    if [ -f "$f" ]; then
      echo "present: ${f#$ROOT_DIR/}"
    else
      echo "missing: ${f#$ROOT_DIR/}"
    fi
  done
} >"$OUT_DIR/env_files.txt"

# The two most common "hang" precursors: shared build + prisma generate.
run_and_log "pnpm_shared_build" pnpm --filter @eggturtle/shared build
run_and_log "pnpm_api_prisma_generate" pnpm --filter @eggturtle/api prisma:generate

note ""
note "Wrote debug bundle: $OUT_DIR"
note "Next: open ports.txt and ps.txt to see port conflicts / leftover processes."
