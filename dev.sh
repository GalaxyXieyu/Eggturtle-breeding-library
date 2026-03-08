#!/bin/bash

# Eggturtle SaaS 本地开发管理脚本
# 用法: ./dev.sh [start|stop|status|help]

set -u
set -o pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="$(printf "%s" "$PROJECT_DIR" | cksum | awk '{print $1}')"
RUNTIME_BASE="${TMPDIR:-/tmp}"
RUNTIME_DIR="${RUNTIME_BASE%/}/eggturtle-dev-${PROJECT_ID}"
LOCK_DIR="${RUNTIME_DIR}.lock"

WEB_NEXT_DIR="$PROJECT_DIR/apps/web/.next"
WEB_NEXT_DEV_DIR="$PROJECT_DIR/apps/web/.next-dev"
ADMIN_NEXT_DIR="$PROJECT_DIR/apps/admin/.next"
ADMIN_NEXT_DEV_DIR="$PROJECT_DIR/apps/admin/.next-dev"

API_PID_FILE="$RUNTIME_DIR/api.pid"
WEB_PID_FILE="$RUNTIME_DIR/web.pid"
ADMIN_PID_FILE="$RUNTIME_DIR/admin.pid"

LEGACY_API_PID_FILE="/tmp/eggturtle-api.pid"
LEGACY_WEB_PID_FILE="/tmp/eggturtle-web.pid"
LEGACY_ADMIN_PID_FILE="/tmp/eggturtle-admin.pid"

API_LOG="/tmp/eggturtle-api.log"
WEB_LOG="/tmp/eggturtle-web.log"
ADMIN_LOG="/tmp/eggturtle-admin.log"

API_PROCESS_MARKER="pnpm --filter @eggturtle/api dev"
WEB_PROCESS_MARKER="pnpm --filter @eggturtle/web dev"
ADMIN_PROCESS_MARKER="pnpm --filter @eggturtle/admin dev"

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:30011/health}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:30010/login}"
ADMIN_HEALTH_URL="${ADMIN_HEALTH_URL:-http://127.0.0.1:30020/login}"

API_STATUS_URL="${API_STATUS_URL:-http://127.0.0.1:30011/health}"
WEB_STATUS_URL="${WEB_STATUS_URL:-http://127.0.0.1:30010}"
ADMIN_STATUS_URL="${ADMIN_STATUS_URL:-http://127.0.0.1:30020}"

WEB_CSS_CHECK_URL="${WEB_CSS_CHECK_URL:-http://127.0.0.1:30010/_next/static/css/app/layout.css}"
SKIP_WEB_ASSET_CHECK="${SKIP_WEB_ASSET_CHECK:-0}"
CLEAN_ON_START="${CLEAN_ON_START:-0}"

LAST_START_WAS_RUNNING=0

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
  echo -e "${BLUE}=== $1 ===${NC}"
}

release_lock() {
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}

acquire_lock() {
  if mkdir "$LOCK_DIR" >/dev/null 2>&1; then
    trap release_lock EXIT
    return 0
  fi

  print_error "检测到另一个 dev.sh 正在执行，请稍后重试。"
  exit 1
}

is_running() {
  local pid_file="$1"
  local process_marker="${2:-}"

  if [ ! -f "$pid_file" ]; then
    return 1
  fi

  local pid
  pid=$(cat "$pid_file" 2>/dev/null || true)
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    return 1
  fi

  if ! ps -p "$pid" >/dev/null 2>&1; then
    return 1
  fi

  if [ -n "$process_marker" ]; then
    local cmdline
    cmdline=$(ps -p "$pid" -o command= 2>/dev/null || true)
    [[ "$cmdline" == *"$process_marker"* ]]
    return $?
  fi

  return 0
}

cleanup_pid_file() {
  local pid_file="$1"
  local process_marker="${2:-}"

  if [ -f "$pid_file" ] && ! is_running "$pid_file" "$process_marker"; then
    rm -f "$pid_file"
  fi
}

migrate_legacy_pid_file() {
  local legacy_pid_file="$1"
  local current_pid_file="$2"
  local process_marker="$3"

  if [ -f "$current_pid_file" ]; then
    return
  fi

  if [ ! -f "$legacy_pid_file" ]; then
    return
  fi

  if is_running "$legacy_pid_file" "$process_marker"; then
    mv "$legacy_pid_file" "$current_pid_file"
    print_warn "检测到旧版 PID 文件，已迁移到: $current_pid_file"
  else
    rm -f "$legacy_pid_file"
  fi
}

prepare_runtime() {
  mkdir -p "$RUNTIME_DIR"

  migrate_legacy_pid_file "$LEGACY_API_PID_FILE" "$API_PID_FILE" "$API_PROCESS_MARKER"
  migrate_legacy_pid_file "$LEGACY_WEB_PID_FILE" "$WEB_PID_FILE" "$WEB_PROCESS_MARKER"
  migrate_legacy_pid_file "$LEGACY_ADMIN_PID_FILE" "$ADMIN_PID_FILE" "$ADMIN_PROCESS_MARKER"
}

wait_for_url() {
  local url="$1"
  local retries="${2:-40}"
  local delay="${3:-0.5}"

  for ((i = 1; i <= retries; i++)); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

extract_port_from_url() {
  local url="$1"
  printf '%s\n' "$url" | sed -nE 's#^[a-zA-Z]+://[^:/]+:([0-9]+).*#\1#p'
}

get_listener_pid_from_url() {
  local url="$1"
  local port
  local lsof_bin

  port="$(extract_port_from_url "$url")"
  if [ -z "$port" ]; then
    return 1
  fi

  lsof_bin="$(command -v lsof 2>/dev/null || true)"
  if [ -z "$lsof_bin" ] && [ -x "/usr/sbin/lsof" ]; then
    lsof_bin="/usr/sbin/lsof"
  fi

  if [ -z "$lsof_bin" ]; then
    return 1
  fi

  "$lsof_bin" -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1
}

find_pids_by_marker() {
  local process_marker="$1"

  if [ -z "$process_marker" ]; then
    return 1
  fi

  ps -axo pid=,command= | awk -v marker="$process_marker" 'index($0, marker) { print $1 }'
}

collect_descendant_pids() {
  local root_pid="$1"

  python3 - "$root_pid" <<'PY2'
import subprocess
import sys
from collections import defaultdict, deque

root = int(sys.argv[1])
out = subprocess.check_output(["ps", "-axo", "pid=,ppid="], text=True)
children = defaultdict(list)
for line in out.splitlines():
    parts = line.split()
    if len(parts) != 2:
        continue
    pid, ppid = map(int, parts)
    children[ppid].append(pid)

seen = set()
queue = deque([root])
result = []
while queue:
    pid = queue.popleft()
    for child in children.get(pid, []):
        if child in seen:
            continue
        seen.add(child)
        result.append(child)
        queue.append(child)

print(" ".join(map(str, result)))
PY2
}

kill_pid_and_descendants() {
  local root_pid="$1"

  if ! [[ "$root_pid" =~ ^[0-9]+$ ]]; then
    return 0
  fi

  local descendants
  descendants="$(collect_descendant_pids "$root_pid")"

  if [ -n "$descendants" ]; then
    kill $descendants >/dev/null 2>&1 || true
  fi
  kill "$root_pid" >/dev/null 2>&1 || true
  sleep 1

  if [ -n "$descendants" ]; then
    kill -9 $descendants >/dev/null 2>&1 || true
  fi
  if ps -p "$root_pid" >/dev/null 2>&1; then
    kill -9 "$root_pid" >/dev/null 2>&1 || true
  fi
}

start_service() {
  local name="$1"
  local cmd="$2"
  local pid_file="$3"
  local log_file="$4"
  local health_url="${5:-}"
  local process_marker="${6:-}"

  cleanup_pid_file "$pid_file" "$process_marker"

  if is_running "$pid_file" "$process_marker"; then
    local pid
    pid=$(cat "$pid_file")
    LAST_START_WAS_RUNNING=1
    print_info "$name 已在运行 (PID: $pid)"
    return 0
  fi

  print_info "启动 $name ..."
  cd "$PROJECT_DIR" || return 1
  sh -c "$cmd" </dev/null >"$log_file" 2>&1 &
  printf '%s\n' "$!" >"$pid_file"

  sleep 2
  if is_running "$pid_file" "$process_marker"; then
    local pid
    pid=$(cat "$pid_file")
    LAST_START_WAS_RUNNING=0
    if [ -n "$health_url" ]; then
      if wait_for_url "$health_url" 60 0.5; then
        print_info "$name 启动成功 (PID: $pid)"
      else
        print_error "$name 启动后健康检查失败: $health_url"
        print_error "请检查日志: tail -f $log_file"
        tail -n 30 "$log_file" || true
        stop_service "$name" "$pid_file" "$process_marker" >/dev/null 2>&1 || true
        return 1
      fi
    else
      print_info "$name 启动成功 (PID: $pid)"
    fi
  else
    print_error "$name 启动失败，请检查日志: tail -f $log_file"
    rm -f "$pid_file"
    return 1
  fi
}

stop_service() {
  local name="$1"
  local pid_file="$2"
  local process_marker="${3:-}"
  local pid=""
  local marker_pids=""
  local matched_pids=""

  marker_pids="$(find_pids_by_marker "$process_marker" || true)"

  if is_running "$pid_file" "$process_marker"; then
    pid=$(cat "$pid_file")
    matched_pids="$(printf '%s
%s
' "$pid" "$marker_pids" | awk 'NF && !seen[$1]++' | paste -sd' ' -)"
  else
    matched_pids="$(printf '%s
' "$marker_pids" | awk 'NF && !seen[$1]++' | paste -sd' ' -)"
    if [ -n "$matched_pids" ]; then
      print_warn "$name 的 PID 文件无效，改为按进程特征清理: $matched_pids"
    else
      print_warn "$name 未运行"
      rm -f "$pid_file"
      return 0
    fi
  fi

  print_info "停止 $name (PID: $matched_pids) ..."
  for target_pid in $matched_pids; do
    kill_pid_and_descendants "$target_pid"
  done

  rm -f "$pid_file"
  print_info "$name 已停止"
}

show_service_status() {
  local name="$1"
  local pid_file="$2"
  local url="$3"
  local process_marker="${4:-}"

  cleanup_pid_file "$pid_file" "$process_marker"

  if is_running "$pid_file" "$process_marker"; then
    local pid
    pid=$(cat "$pid_file")
    echo "  ✅ $name 运行中 (PID: $pid)"

    if [ -n "$url" ]; then
      if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
        echo "     ✅ 可访问: $url"
      else
        echo "     ⚠️  进程存活但未通过 URL 检查: $url"
      fi
    fi
  else
    echo "  ❌ $name 未运行"
  fi
}

safe_remove_cache_dir() {
  local dir_path="$1"
  local base_name

  if [[ "$dir_path" != "$PROJECT_DIR/"* ]]; then
    print_warn "跳过危险路径: $dir_path"
    return 1
  fi

  base_name="$(basename "$dir_path")"
  if [ "$base_name" != ".next" ] && [ "$base_name" != ".next-dev" ]; then
    print_warn "跳过非 Next.js 缓存目录: $dir_path"
    return 1
  fi

  rm -rf "$dir_path"
  return 0
}

clean_next_cache() {
  print_header "清理 Next.js 构建缓存"
  safe_remove_cache_dir "$WEB_NEXT_DIR" || true
  safe_remove_cache_dir "$WEB_NEXT_DEV_DIR" || true
  safe_remove_cache_dir "$ADMIN_NEXT_DIR" || true
  safe_remove_cache_dir "$ADMIN_NEXT_DEV_DIR" || true
  print_info "已清理:"
  echo "  - $WEB_NEXT_DIR"
  echo "  - $WEB_NEXT_DEV_DIR"
  echo "  - $ADMIN_NEXT_DIR"
  echo "  - $ADMIN_NEXT_DEV_DIR"
}

rollback_started_services() {
  local api_started="$1"
  local web_started="$2"
  local admin_started="$3"

  print_warn "检测到部分服务启动失败，回滚本次新启动的服务..."

  if [ "$admin_started" -eq 1 ]; then
    stop_service "Admin" "$ADMIN_PID_FILE" "$ADMIN_PROCESS_MARKER"
  fi
  if [ "$web_started" -eq 1 ]; then
    stop_service "Web" "$WEB_PID_FILE" "$WEB_PROCESS_MARKER"
  fi
  if [ "$api_started" -eq 1 ]; then
    stop_service "API" "$API_PID_FILE" "$API_PROCESS_MARKER"
  fi
}

ensure_local_generated_assets_schema() {
  print_info "校验本地夫妻图/证书库表..."
  if ! DATABASE_URL="${DATABASE_URL:-postgres://eggturtle:eggturtle@localhost:30001/eggturtle}" \
    "$PROJECT_DIR/scripts/migrate/ensure_local_generated_assets_schema.sh"; then
    print_error "本地 generated-assets 库表修复失败。"
    return 1
  fi
}

start_all() {
  print_header "启动 Eggturtle SaaS 开发环境"
  local api_started=0
  local web_started=0
  local admin_started=0

  if ! command -v pnpm >/dev/null 2>&1; then
    print_error "未找到 pnpm，请先安装 pnpm。"
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    print_error "未找到 curl，请先安装 curl。"
    exit 1
  fi

  if ! ensure_local_generated_assets_schema; then
    exit 1
  fi

  if start_service "API" "pnpm --filter @eggturtle/api dev" "$API_PID_FILE" "$API_LOG" "$API_HEALTH_URL" "$API_PROCESS_MARKER"; then
    if [ "$LAST_START_WAS_RUNNING" -eq 0 ]; then
      api_started=1
    fi
  else
    exit 1
  fi

  if start_service "Web" "pnpm --filter @eggturtle/web dev" "$WEB_PID_FILE" "$WEB_LOG" "$WEB_HEALTH_URL" "$WEB_PROCESS_MARKER"; then
    if [ "$LAST_START_WAS_RUNNING" -eq 0 ]; then
      web_started=1
    fi
  else
    rollback_started_services "$api_started" "$web_started" "$admin_started"
    exit 1
  fi

  if start_service "Admin" "pnpm --filter @eggturtle/admin dev" "$ADMIN_PID_FILE" "$ADMIN_LOG" "$ADMIN_HEALTH_URL" "$ADMIN_PROCESS_MARKER"; then
    if [ "$LAST_START_WAS_RUNNING" -eq 0 ]; then
      admin_started=1
    fi
  else
    rollback_started_services "$api_started" "$web_started" "$admin_started"
    exit 1
  fi

  # 分享端历史上出现过 CSS 缓存异常，保留启动后探测，但允许通过环境变量关闭。
  if [ "$SKIP_WEB_ASSET_CHECK" != "1" ] && ! curl -fsS --max-time 5 "$WEB_CSS_CHECK_URL" >/dev/null 2>&1; then
    print_warn "Web CSS 资源检查失败，建议执行: CLEAN_ON_START=1 ./dev.sh start（或设置 SKIP_WEB_ASSET_CHECK=1 跳过）"
  fi

  echo
  show_status
}

stop_all() {
  print_header "停止 Eggturtle SaaS 服务"
  stop_service "Admin" "$ADMIN_PID_FILE" "$ADMIN_PROCESS_MARKER"
  stop_service "Web" "$WEB_PID_FILE" "$WEB_PROCESS_MARKER"
  stop_service "API" "$API_PID_FILE" "$API_PROCESS_MARKER"
}

show_status() {
  print_header "Eggturtle SaaS 服务状态"
  show_service_status "API" "$API_PID_FILE" "$API_STATUS_URL" "$API_PROCESS_MARKER"
  show_service_status "Web" "$WEB_PID_FILE" "$WEB_STATUS_URL" "$WEB_PROCESS_MARKER"
  show_service_status "Admin" "$ADMIN_PID_FILE" "$ADMIN_STATUS_URL" "$ADMIN_PROCESS_MARKER"

  echo
  echo "日志文件:"
  echo "  API   : $API_LOG"
  echo "  Web   : $WEB_LOG"
  echo "  Admin : $ADMIN_LOG"
}

start_with_restart() {
  stop_all
  echo
  if [ "$CLEAN_ON_START" = "1" ]; then
    clean_next_cache
    echo
  fi
  start_all
}

show_help() {
  cat <<'USAGE'
Eggturtle SaaS 本地开发管理脚本

用法:
  ./dev.sh start
  ./dev.sh stop
  ./dev.sh status
  ./dev.sh help

说明:
  start 默认包含 restart 逻辑（先停后启）
  可选：CLEAN_ON_START=1 ./dev.sh start
USAGE
}

case "${1:-help}" in
start)
  prepare_runtime
  acquire_lock
  start_with_restart
  ;;
stop)
  prepare_runtime
  acquire_lock
  stop_all
  ;;
status)
  prepare_runtime
  show_status
  ;;
help|--help|-h)
  show_help
  ;;
*)
  print_error "未知命令: $1"
  show_help
  exit 1
  ;;
esac
