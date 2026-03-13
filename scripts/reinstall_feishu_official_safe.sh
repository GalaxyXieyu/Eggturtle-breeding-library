#!/usr/bin/env bash
set -euo pipefail

DEFAULT_CONFIG_PATH="/Users/apple/coding/.openclaw/openclaw.json"
CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$DEFAULT_CONFIG_PATH}"
INSTALLER_PACKAGE="${OPENCLAW_LARK_INSTALLER_PACKAGE:-@larksuite/openclaw-lark-tools}"
MODE="${1:-full}"

if [[ -f "$CONFIG_PATH" ]]; then
  STATE_DIR="$(cd "$(dirname "$CONFIG_PATH")" && pwd)"
else
  STATE_DIR="$(dirname "$CONFIG_PATH")"
fi

BEHAVIOR_PATH="${OPENCLAW_FEISHU_BEHAVIOR_PATH:-$STATE_DIR/feishu-behavior.preinstall.json}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="${OPENCLAW_CONFIG_BACKUP_PATH:-$CONFIG_PATH.bak.$TIMESTAMP}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [prepare|install|restore|verify|full]

Modes:
  prepare  Backup current config and export Feishu behavior snapshot.
  install  Run the official interactive Feishu installer.
  restore  Re-apply preserved Feishu behavior and sync feishu-mcp env.
  verify   Validate local config consistency and print follow-up checks.
  full     Run prepare -> install -> restore -> verify.

Environment:
  OPENCLAW_CONFIG_PATH               Override OpenClaw config path.
  OPENCLAW_FEISHU_BEHAVIOR_PATH      Override behavior snapshot path.
  OPENCLAW_CONFIG_BACKUP_PATH        Override config backup path.
  OPENCLAW_LARK_INSTALLER_PACKAGE    Override installer package name.
EOF
}

log() {
  printf '[feishu-reinstall] %s\n' "$*"
}

fail() {
  printf '[feishu-reinstall] ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

ensure_config_exists() {
  [[ -f "$CONFIG_PATH" ]] || fail "OpenClaw config not found: $CONFIG_PATH"
}

prepare() {
  need_cmd jq
  ensure_config_exists

  mkdir -p "$STATE_DIR"
  cp "$CONFIG_PATH" "$BACKUP_PATH"
  log "Config backup created: $BACKUP_PATH"

  jq '{
    appId: .channels.feishu.appId,
    groupPolicy: .channels.feishu.groupPolicy,
    groups: .channels.feishu.groups,
    requireMention: .channels.feishu.requireMention,
    topicSessionMode: .channels.feishu.topicSessionMode,
    capabilities: .channels.feishu.capabilities,
    heartbeat: .channels.feishu.heartbeat,
    streaming: .channels.feishu.streaming,
    threadSession: .channels.feishu.threadSession,
    footer: .channels.feishu.footer
  }' "$CONFIG_PATH" > "$BEHAVIOR_PATH"

  log "Behavior snapshot exported: $BEHAVIOR_PATH"
  log "Old appId: $(jq -r '.channels.feishu.appId // "<missing>"' "$CONFIG_PATH")"
}

install_official() {
  need_cmd npx
  log "Starting official Feishu installer. Choose '新建机器人' in the interactive flow."
  npx -y "$INSTALLER_PACKAGE" install
}

restore() {
  need_cmd jq
  ensure_config_exists
  [[ -f "$BEHAVIOR_PATH" ]] || fail "Behavior snapshot not found: $BEHAVIOR_PATH"

  local tmp_file
  tmp_file="$(mktemp)"

  jq --slurpfile behavior "$BEHAVIOR_PATH" '
    def keep_non_null: with_entries(select(.value != null));
    .channels.feishu |= (. + ($behavior[0] | keep_non_null))
    | .plugins.entries.feishu.enabled = true
    | .plugins.entries.acpx.config.mcpServers["feishu-mcp"].env.APP_ID = .channels.feishu.appId
    | .plugins.entries.acpx.config.mcpServers["feishu-mcp"].env.APP_SECRET = .channels.feishu.appSecret
  ' "$CONFIG_PATH" > "$tmp_file"

  mv "$tmp_file" "$CONFIG_PATH"
  log "Behavior restored and feishu-mcp env synced."
}

verify() {
  need_cmd jq
  ensure_config_exists

  local channel_app_id
  local channel_app_secret
  local mcp_app_id
  local mcp_app_secret
  local old_app_id

  channel_app_id="$(jq -r '.channels.feishu.appId // empty' "$CONFIG_PATH")"
  channel_app_secret="$(jq -r '.channels.feishu.appSecret // empty' "$CONFIG_PATH")"
  mcp_app_id="$(jq -r '.plugins.entries.acpx.config.mcpServers["feishu-mcp"].env.APP_ID // empty' "$CONFIG_PATH")"
  mcp_app_secret="$(jq -r '.plugins.entries.acpx.config.mcpServers["feishu-mcp"].env.APP_SECRET // empty' "$CONFIG_PATH")"
  old_app_id="$(if [[ -f "$BEHAVIOR_PATH" ]]; then jq -r '.appId // empty' "$BEHAVIOR_PATH"; fi)"

  [[ -n "$channel_app_id" ]] || fail "channels.feishu.appId is empty after install."
  [[ -n "$channel_app_secret" ]] || fail "channels.feishu.appSecret is empty after install."
  [[ "$channel_app_id" == "$mcp_app_id" ]] || fail "feishu-mcp APP_ID does not match channels.feishu.appId."
  [[ "$channel_app_secret" == "$mcp_app_secret" ]] || fail "feishu-mcp APP_SECRET does not match channels.feishu.appSecret."

  log "Local config is aligned."
  log "Current appId: $channel_app_id"
  if [[ -n "$old_app_id" && "$old_app_id" != "$channel_app_id" ]]; then
    log "App switched from old appId to new appId."
  fi

  cat <<EOF

Next checks in Feishu:
  1. Send /feishu start
  2. Send /feishu auth
  3. Ask: 学习一下我安装的新飞书插件，列出有哪些能力

Optional local checks:
  npx -y $INSTALLER_PACKAGE doctor
  npx -y $INSTALLER_PACKAGE doctor --fix
EOF
}

case "$MODE" in
  prepare)
    prepare
    ;;
  install)
    install_official
    ;;
  restore)
    restore
    ;;
  verify)
    verify
    ;;
  full)
    prepare
    install_official
    restore
    verify
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    fail "Unknown mode: $MODE"
    ;;
esac
