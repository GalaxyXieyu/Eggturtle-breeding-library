#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_ROOT="${OUT_ROOT:-$ROOT_DIR/out/p0-regression}"
API_BASE="${API_BASE:-http://localhost:30011}"
WEB_BASE="${WEB_BASE:-http://localhost:30010}"
ONLY_MODULES="${ONLY_MODULES:-auth,products,images,featured,shares,subscription,admin,account-matrix}"
NODE_ENV="${NODE_ENV:-development}"
AUTH_DEV_CODE_ENABLED="${AUTH_DEV_CODE_ENABLED:-true}"
AUTO_START_API="${AUTO_START_API:-0}"
API_START_TIMEOUT_SEC="${API_START_TIMEOUT_SEC:-60}"
SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-}"

if [[ -z "$SUPER_ADMIN_EMAIL" ]]; then
  echo "SUPER_ADMIN_EMAIL is required (super-admin allowlist account email)." >&2
  exit 2
fi

if [[ "$NODE_ENV" != "development" ]]; then
  echo "NODE_ENV must be development (got: $NODE_ENV)." >&2
  exit 2
fi

if [[ "$AUTH_DEV_CODE_ENABLED" != "true" ]]; then
  echo "AUTH_DEV_CODE_ENABLED must be true (got: $AUTH_DEV_CODE_ENABLED)." >&2
  exit 2
fi

run_id="$(date +%Y%m%d-%H%M%S)"
run_dir="$OUT_ROOT/$run_id"
mkdir -p "$run_dir"

command_file="$run_dir/command.sh"
jsonl_file="$run_dir/api-tests.events.jsonl"
api_tests_log="$run_dir/api-tests.log"
api_tests_summary="$run_dir/api-tests.summary.json"
tenant_feed_log="$run_dir/tenant-feed-share-smoke.log"
summary_md="$run_dir/summary.md"
api_log="$run_dir/api-dev.log"
started_api_pid=""

health_ok() {
  curl -fsS -m 3 "$API_BASE/health" >/dev/null 2>&1
}

cleanup() {
  if [[ -n "$started_api_pid" ]] && kill -0 "$started_api_pid" >/dev/null 2>&1; then
    kill "$started_api_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! health_ok; then
  if [[ "$AUTO_START_API" == "1" ]]; then
    (
      cd "$ROOT_DIR"
      NODE_ENV="$NODE_ENV" AUTH_DEV_CODE_ENABLED="$AUTH_DEV_CODE_ENABLED" \
        pnpm --filter @eggturtle/api dev >"$api_log" 2>&1
    ) &
    started_api_pid="$!"

    deadline=$((SECONDS + API_START_TIMEOUT_SEC))
    until health_ok; do
      if (( SECONDS >= deadline )); then
        echo "API did not become healthy within ${API_START_TIMEOUT_SEC}s." >&2
        echo "See log: $api_log" >&2
        exit 3
      fi
      sleep 1
    done
  else
    echo "API is unreachable at $API_BASE and AUTO_START_API=0." >&2
    echo "Start API first or set AUTO_START_API=1, then rerun." >&2
    exit 3
  fi
fi

cat >"$command_file" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$ROOT_DIR"
NODE_ENV=development AUTH_DEV_CODE_ENABLED=true \
  pnpm api-tests -- \
    --confirm-writes \
    --clear-token-cache \
    --json \
    --api-base "$API_BASE" \
    --only "$ONLY_MODULES" \
    --super-admin-email "$SUPER_ADMIN_EMAIL" \
    --require-super-admin-pass \
  | tee "$jsonl_file" "$api_tests_log" >/dev/null
EOF
chmod +x "$command_file"

set +e
"$command_file"
api_tests_status=$?
set -e

node - "$jsonl_file" "$api_tests_summary" "$api_tests_status" "$API_BASE" "$ONLY_MODULES" <<'NODE'
const fs = require('node:fs');

const [jsonlPath, summaryPath, runStatusRaw, apiBase, onlyModules] = process.argv.slice(2);
const runStatus = Number(runStatusRaw);

const lines = fs.existsSync(jsonlPath)
  ? fs.readFileSync(jsonlPath, 'utf8').split('\n').filter((line) => line.trim().length > 0)
  : [];

const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    // ignore
  }
}

const runnerDone = [...events].reverse().find((entry) => entry.event === 'runner.done') || null;
const runnerFailed = [...events].reverse().find((entry) => entry.event === 'runner.failed') || null;
const moduleDone = events.filter((entry) => entry.event === 'module.done').map((entry) => entry.module);

const summary = {
  generatedAt: new Date().toISOString(),
  apiBase,
  onlyModules,
  runStatus,
  passed: runStatus === 0 && Boolean(runnerDone) && !runnerFailed,
  moduleDoneCount: moduleDone.length,
  moduleDone,
  runnerDone,
  runnerFailed,
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
NODE

# Tenant feed public share smoke (API-only, secret-safe)
set +e
node "$ROOT_DIR/scripts/smoke/tenant_feed_share_smoke.mjs" \
  --api-base "$API_BASE" \
  --web-base "$WEB_BASE" \
  --out "$run_dir" \
  >"$tenant_feed_log" 2>&1
tenant_feed_status=$?
set -e

api_passed="no"
if node -e 'const s=require(process.argv[1]); process.exit(s.passed?0:1)' "$api_tests_summary"; then
  api_passed="yes"
fi

status_text="PASS"
if [[ "$api_passed" != "yes" ]] || [[ "$tenant_feed_status" -ne 0 ]]; then
  status_text="FAIL"
fi

cat >"$summary_md" <<EOF
# P0 Regression Evidence

- Status: **$status_text**
- Generated: $run_id
- API Base: $API_BASE
- Web Base: $WEB_BASE
- API modules: $ONLY_MODULES

## Evidence Files

- api-tests JSONL: $jsonl_file
- api-tests summary: $api_tests_summary
- api-tests log: $api_tests_log
- tenant_feed smoke log: $tenant_feed_log
- reproduce command: $command_file
EOF

echo "Evidence summary: $summary_md"

if [[ "$status_text" != "PASS" ]]; then
  exit 1
fi
