#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_ROOT="${OUT_ROOT:-$ROOT_DIR/out/t61-offboard}"
API_BASE="${API_BASE:-http://localhost:30011}"
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
jsonl_raw="$run_dir/api-tests.events.raw.jsonl"
jsonl_file="$run_dir/api-tests.events.redacted.jsonl"
api_tests_log_raw="$run_dir/api-tests.raw.log"
api_tests_log="$run_dir/api-tests.redacted.log"
api_tests_summary="$run_dir/api-tests.summary.json"
summary_md="$run_dir/summary.md"
api_log="$run_dir/api-dev.log"
key_urls_redacted="$run_dir/key-urls-redacted.txt"
started_api_pid=""

api_port="$(echo "$API_BASE" | sed -E 's#^https?://[^:/]+:([0-9]+).*$#\1#')"
if ! [[ "$api_port" =~ ^[0-9]+$ ]]; then
  api_port=""
fi

health_ok() {
  curl -fsS -m 3 "$API_BASE/health" >/dev/null 2>&1
}

route_probe_status() {
  local probe_file="$run_dir/route-probe.json"
  cat >"$probe_file" <<'JSON'
{"reason":"probe-only","confirmTenantSlug":"probe-slug"}
JSON
  curl -sS -o /dev/null -w "%{http_code}" -m 5 \
    -H 'Content-Type: application/json' \
    -X POST "$API_BASE/admin/tenants/probe-id/lifecycle/offboard" \
    --data-binary "@$probe_file" || true
}

start_api_dev() {
  (
    cd "$ROOT_DIR"
    NODE_ENV="$NODE_ENV" AUTH_DEV_CODE_ENABLED="$AUTH_DEV_CODE_ENABLED" \
      pnpm --filter @eggturtle/api dev >"$api_log" 2>&1
  ) &
  started_api_pid="$!"

  local deadline=$((SECONDS + API_START_TIMEOUT_SEC))
  until health_ok; do
    if (( SECONDS >= deadline )); then
      echo "API did not become healthy within ${API_START_TIMEOUT_SEC}s." >&2
      echo "See log: $api_log" >&2
      exit 3
    fi
    sleep 1
  done
}

cleanup() {
  if [[ -n "$started_api_pid" ]] && kill -0 "$started_api_pid" >/dev/null 2>&1; then
    kill "$started_api_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! health_ok; then
  if [[ "$AUTO_START_API" == "1" ]]; then
    start_api_dev
  else
    echo "API is unreachable at $API_BASE and AUTO_START_API=0." >&2
    echo "Start API first or set AUTO_START_API=1, then rerun." >&2
    exit 3
  fi
fi

probe_status="$(route_probe_status)"
if [[ "$probe_status" == "404" ]]; then
  if [[ "$AUTO_START_API" == "1" ]] && [[ -n "$api_port" ]]; then
    stale_pids="$(lsof -ti "tcp:${api_port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$stale_pids" ]]; then
      kill $stale_pids >/dev/null 2>&1 || true
      sleep 1
    fi
    start_api_dev
    probe_status="$(route_probe_status)"
  fi
fi

if [[ "$probe_status" == "404" ]]; then
  echo "Offboard route probe returned 404 on $API_BASE." >&2
  echo "Likely stale API process / wrong port / route not loaded." >&2
  echo "Quick fix: restart API dev process, or rerun with AUTO_START_API=1." >&2
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
    --only admin \
    --super-admin-email "$SUPER_ADMIN_EMAIL" \
    --require-super-admin-pass
EOF
chmod +x "$command_file"

set +e
"$command_file" | tee "$jsonl_raw" "$api_tests_log_raw" >/dev/null
api_tests_status=$?
set -e

redact_stream() {
  sed -E \
    -e 's#(https?://[^ ?"\x27]+)(\?[^ "\x27]*)?#\1?[REDACTED]#g' \
    -e 's#([?&](token|sig|devCode|code|auth|authorization|access_token|refresh_token)=)[^&"\x27 ]+#\1[REDACTED]#gi' \
    -e 's#(Bearer[[:space:]]+)[A-Za-z0-9._~-]+#\1[REDACTED]#g' \
    -e 's#("(token|sig|devCode|code|authorization|accessToken|refreshToken)"[[:space:]]*:[[:space:]]*")[^"]+#\1[REDACTED]#gi'
}

redact_stream <"$jsonl_raw" >"$jsonl_file"
redact_stream <"$api_tests_log_raw" >"$api_tests_log"

cat "$jsonl_raw" "$api_tests_log_raw" \
  | rg -o 'https?://[^"'"'"'[:space:]]+' \
  | sort -u \
  | sed -E 's#(https?://[^?]+)(\?.*)?#\1?[REDACTED]#' >"$key_urls_redacted" || true

node - "$jsonl_file" "$api_tests_summary" "$api_tests_status" "$API_BASE" "$probe_status" <<'NODE'
const fs = require('node:fs');

const [jsonlPath, summaryPath, runStatusRaw, apiBase, probeStatus] = process.argv.slice(2);
const runStatus = Number(runStatusRaw);

const lines = fs.existsSync(jsonlPath)
  ? fs.readFileSync(jsonlPath, 'utf8').split('\n').filter((line) => line.trim().length > 0)
  : [];

const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    // ignore non-json lines
  }
}

const runnerDone = [...events].reverse().find((entry) => entry.event === 'runner.done') || null;
const runnerFailed = [...events].reverse().find((entry) => entry.event === 'runner.failed') || null;
const failedMessage = typeof runnerFailed?.error === 'string' ? runnerFailed.error : '';
const offboard404 = /admin\.lifecycle\.offboard: expected HTTP 201, got 404/.test(failedMessage);

const summary = {
  generatedAt: new Date().toISOString(),
  apiBase,
  module: 'admin',
  routeProbeStatus: probeStatus,
  runStatus,
  passed: runStatus === 0 && Boolean(runnerDone) && !runnerFailed,
  offboardRoute404Detected: offboard404,
  runnerDone,
  runnerFailed,
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
NODE

status_text="PASS"
diagnosis_note=""
if ! node -e 'const s=require(process.argv[1]); process.exit(s.passed?0:1)' "$api_tests_summary"; then
  status_text="FAIL"
fi

if node -e 'const s=require(process.argv[1]); process.exit(s.offboardRoute404Detected?0:1)' "$api_tests_summary"; then
  diagnosis_note="- Diagnosis: offboard route returned 404. Likely API process not restarted / wrong API_BASE / route not registered in current process.\n- Quick fix: restart API dev, or run AUTO_START_API=1 to force local API restart before running evidence script."
fi

cat >"$summary_md" <<EOF
# T61 Offboard Evidence (API-only)

- Status: **$status_text**
- Generated: $run_id
- API Base: $API_BASE
- Route probe status (unauth POST): $probe_status

This run executes scripts/api-tests/admin.ts (admin module), which includes:
- tenant lifecycle suspend/reactivate/offboard checks
- offboard reason + confirmTenantSlug validation

## Evidence Files (redacted)

- api-tests JSONL: $jsonl_file
- api-tests summary: $api_tests_summary
- api-tests log: $api_tests_log
- key URLs (redacted): $key_urls_redacted
- reproduce command: $command_file

$diagnosis_note
EOF

echo "Evidence summary: $summary_md"

if [[ "$status_text" != "PASS" ]]; then
  exit 1
fi
