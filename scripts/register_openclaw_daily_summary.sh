#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${OPENCLAW_DAILY_SUMMARY_ENV_FILE:-$ROOT_DIR/.env.openclaw-daily-summary}"
APPLY=0

if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

OPENCLAW_AGENT_ID="${OPENCLAW_AGENT_ID:-eggturtle-codex}"
OPENCLAW_JOB_NAME="${OPENCLAW_JOB_NAME:-Eggturtle 日报 22:30}"
OPENCLAW_CRON_EXPR="${OPENCLAW_CRON_EXPR:-30 22 * * *}"
OPENCLAW_REPORT_TIMEZONE="${OPENCLAW_REPORT_TIMEZONE:-Asia/Shanghai}"
OPENCLAW_REPORT_REPO_ROOT="${OPENCLAW_REPORT_REPO_ROOT:-$ROOT_DIR}"
OPENCLAW_REPORT_OUTPUT_DIR="${OPENCLAW_REPORT_OUTPUT_DIR:-out/openclaw-reports/daily}"
OPENCLAW_FEISHU_CHAT_ID="${OPENCLAW_FEISHU_CHAT_ID:-}"
OPENCLAW_FEISHU_FOLDER_TOKEN="${OPENCLAW_FEISHU_FOLDER_TOKEN:-}"
OPENCLAW_FEISHU_DOC_TOKEN="${OPENCLAW_FEISHU_DOC_TOKEN:-}"
OPENCLAW_GATEWAY_URL="${OPENCLAW_GATEWAY_URL:-}"
PROMPT_TEMPLATE_PATH="${OPENCLAW_PROMPT_TEMPLATE_PATH:-$ROOT_DIR/docs/openclaw/openclaw-daily-summary.prompt.template.md}"

PROMPT_CONTENT="$({
  PROMPT_TEMPLATE_PATH="$PROMPT_TEMPLATE_PATH" \
  OPENCLAW_AGENT_ID="$OPENCLAW_AGENT_ID" \
  OPENCLAW_REPORT_TIMEZONE="$OPENCLAW_REPORT_TIMEZONE" \
  OPENCLAW_REPORT_REPO_ROOT="$OPENCLAW_REPORT_REPO_ROOT" \
  OPENCLAW_REPORT_OUTPUT_DIR="$OPENCLAW_REPORT_OUTPUT_DIR" \
  OPENCLAW_FEISHU_CHAT_ID="$OPENCLAW_FEISHU_CHAT_ID" \
  OPENCLAW_FEISHU_FOLDER_TOKEN="$OPENCLAW_FEISHU_FOLDER_TOKEN" \
  OPENCLAW_FEISHU_DOC_TOKEN="$OPENCLAW_FEISHU_DOC_TOKEN" \
  python3 - <<'PY'
import os
from pathlib import Path

template = Path(os.environ['PROMPT_TEMPLATE_PATH']).read_text(encoding='utf-8')
replacements = {
    '{{agent_id}}': os.environ['OPENCLAW_AGENT_ID'],
    '{{timezone}}': os.environ['OPENCLAW_REPORT_TIMEZONE'],
    '{{repo_root}}': os.environ['OPENCLAW_REPORT_REPO_ROOT'],
    '{{output_dir}}': os.environ['OPENCLAW_REPORT_OUTPUT_DIR'],
    '{{chat_id}}': os.environ['OPENCLAW_FEISHU_CHAT_ID'] or '未配置',
    '{{folder_token}}': os.environ['OPENCLAW_FEISHU_FOLDER_TOKEN'] or '未配置',
    '{{doc_token}}': os.environ['OPENCLAW_FEISHU_DOC_TOKEN'] or '未配置',
}
for key, value in replacements.items():
    template = template.replace(key, value)
print(template.strip())
PY
})"

echo "[preview] agent      : $OPENCLAW_AGENT_ID"
echo "[preview] cron       : $OPENCLAW_CRON_EXPR ($OPENCLAW_REPORT_TIMEZONE)"
echo "[preview] repo       : $OPENCLAW_REPORT_REPO_ROOT"
echo "[preview] group chat : ${OPENCLAW_FEISHU_CHAT_ID:-<missing>}"
echo "[preview] folder     : ${OPENCLAW_FEISHU_FOLDER_TOKEN:-<missing>}"
echo "[preview] doc token  : ${OPENCLAW_FEISHU_DOC_TOKEN:-<missing>}"
echo
echo "[preview] prompt"
echo "----------------------------------------"
echo "$PROMPT_CONTENT"
echo "----------------------------------------"

if [[ "$APPLY" != "1" ]]; then
  echo
  echo "Dry-run only. Re-run with --apply to register the cron job into OpenClaw."
  exit 0
fi

COMMAND=(
  openclaw cron add
  --name "$OPENCLAW_JOB_NAME"
  --cron "$OPENCLAW_CRON_EXPR"
  --tz "$OPENCLAW_REPORT_TIMEZONE"
  --session isolated
  --agent "$OPENCLAW_AGENT_ID"
  --message "$PROMPT_CONTENT"
  --thinking low
  --timeout-seconds 900
  --no-deliver
  --json
)

if [[ -n "$OPENCLAW_GATEWAY_URL" ]]; then
  COMMAND+=(--url "$OPENCLAW_GATEWAY_URL")
fi

"${COMMAND[@]}"
