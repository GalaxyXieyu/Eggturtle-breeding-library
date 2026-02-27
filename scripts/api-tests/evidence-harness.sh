#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_ROOT="${OUT_ROOT:-$ROOT_DIR/out/t26-api-full-run}"
API_BASE="${API_BASE:-http://localhost:30011}"
ONLY_MODULES="${ONLY_MODULES:-auth,products,series,breeders,images,featured,shares,admin}"
NODE_ENV="${NODE_ENV:-development}"
AUTH_DEV_CODE_ENABLED="${AUTH_DEV_CODE_ENABLED:-true}"
AUTO_START_API="${AUTO_START_API:-0}"
API_START_TIMEOUT_SEC="${API_START_TIMEOUT_SEC:-60}"

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
jsonl_file="$run_dir/events.jsonl"
summary_json="$run_dir/summary.json"
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
  pnpm api-tests -- --confirm-writes --clear-token-cache --json --api-base "$API_BASE" --only "$ONLY_MODULES" \
  | tee "$jsonl_file"
EOF
chmod +x "$command_file"

set +e
"$command_file"
run_status=$?
set -e

node - "$jsonl_file" "$summary_json" "$run_status" "$API_BASE" "$ONLY_MODULES" "$command_file" <<'NODE'
const fs = require('node:fs');

const [jsonlPath, summaryPath, runStatusRaw, apiBase, onlyModules, commandFile] = process.argv.slice(2);
const runStatus = Number(runStatusRaw);

const lines = fs.existsSync(jsonlPath)
  ? fs.readFileSync(jsonlPath, 'utf8').split('\n').filter((line) => line.trim().length > 0)
  : [];

const events = [];
for (const line of lines) {
  try {
    events.push(JSON.parse(line));
  } catch {
    // Ignore non-JSON lines in mixed logs.
  }
}

const runnerDone = [...events].reverse().find((entry) => entry.event === 'runner.done') || null;
const runnerFailed = [...events].reverse().find((entry) => entry.event === 'runner.failed') || null;
const moduleDone = events.filter((entry) => entry.event === 'module.done').map((entry) => entry.module);

const summary = {
  generatedAt: new Date().toISOString(),
  apiBase,
  onlyModules,
  commandFile,
  runStatus,
  passed: runStatus === 0 && Boolean(runnerDone) && !runnerFailed,
  moduleDoneCount: moduleDone.length,
  moduleDone,
  runnerDone,
  runnerFailed,
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
NODE

node - "$summary_json" "$summary_md" "$jsonl_file" <<'NODE'
const fs = require('node:fs');

const [summaryPath, markdownPath, jsonlPath] = process.argv.slice(2);
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const statusText = summary.passed ? 'PASS' : 'FAIL';
const totalChecks = summary.runnerDone && typeof summary.runnerDone.totalChecks === 'number'
  ? summary.runnerDone.totalChecks
  : 'n/a';

const lines = [
  '# API Full Run Evidence',
  '',
  `- Status: **${statusText}**`,
  `- Generated: ${summary.generatedAt}`,
  `- API Base: ${summary.apiBase}`,
  `- Modules: ${summary.onlyModules}`,
  `- module.done count: ${summary.moduleDoneCount}`,
  `- total checks: ${totalChecks}`,
  `- command file: ${summary.commandFile}`,
  `- jsonl evidence: ${jsonlPath}`,
  '',
  '## Reproduce',
  '',
  '```bash',
  summary.commandFile,
  '```',
];

if (summary.runnerFailed) {
  lines.push('', '## Failure Snapshot', '', '```json', JSON.stringify(summary.runnerFailed, null, 2), '```');
}

fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`);
NODE

echo "Evidence summary: $summary_md"
echo "Evidence jsonl:   $jsonl_file"

if [[ "$run_status" -ne 0 ]]; then
  exit "$run_status"
fi
