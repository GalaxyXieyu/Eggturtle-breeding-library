#!/bin/bash

# Eggturtle SaaS 本地开发管理脚本
# 用法: ./dev.sh [start|stop|status|restart|help]

set -u

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

API_PID_FILE="/tmp/eggturtle-api.pid"
WEB_PID_FILE="/tmp/eggturtle-web.pid"
ADMIN_PID_FILE="/tmp/eggturtle-admin.pid"

API_LOG="/tmp/eggturtle-api.log"
WEB_LOG="/tmp/eggturtle-web.log"
ADMIN_LOG="/tmp/eggturtle-admin.log"

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

is_running() {
  local pid_file="$1"

  if [ ! -f "$pid_file" ]; then
    return 1
  fi

  local pid
  pid=$(cat "$pid_file")
  if [ -z "$pid" ]; then
    return 1
  fi

  ps -p "$pid" >/dev/null 2>&1
}

cleanup_pid_file() {
  local pid_file="$1"

  if [ -f "$pid_file" ] && ! is_running "$pid_file"; then
    rm -f "$pid_file"
  fi
}

start_service() {
  local name="$1"
  local cmd="$2"
  local pid_file="$3"
  local log_file="$4"

  cleanup_pid_file "$pid_file"

  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    print_info "$name 已在运行 (PID: $pid)"
    return 0
  fi

  print_info "启动 $name ..."
  cd "$PROJECT_DIR" || return 1
  nohup sh -c "$cmd" >"$log_file" 2>&1 &
  echo $! >"$pid_file"

  sleep 2
  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    print_info "$name 启动成功 (PID: $pid)"
  else
    print_error "$name 启动失败，请检查日志: tail -f $log_file"
    return 1
  fi
}

stop_service() {
  local name="$1"
  local pid_file="$2"

  if ! is_running "$pid_file"; then
    print_warn "$name 未运行"
    rm -f "$pid_file"
    return 0
  fi

  local pid
  pid=$(cat "$pid_file")
  print_info "停止 $name (PID: $pid) ..."
  kill "$pid" >/dev/null 2>&1 || true
  sleep 1

  if ps -p "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$pid_file"
  print_info "$name 已停止"
}

show_service_status() {
  local name="$1"
  local pid_file="$2"
  local url="$3"

  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    echo "  ✅ $name 运行中 (PID: $pid)"

    if [ -n "$url" ]; then
      if curl -s "$url" >/dev/null 2>&1; then
        echo "     ✅ 可访问: $url"
      else
        echo "     ⚠️  进程存活但未通过 URL 检查: $url"
      fi
    fi
  else
    echo "  ❌ $name 未运行"
  fi
}

start_all() {
  print_header "启动 Eggturtle SaaS 开发环境"

  if ! command -v pnpm >/dev/null 2>&1; then
    print_error "未找到 pnpm，请先安装 pnpm。"
    exit 1
  fi

  start_service "API" "pnpm --filter @eggturtle/api dev" "$API_PID_FILE" "$API_LOG" || exit 1
  start_service "Web" "pnpm --filter @eggturtle/web dev" "$WEB_PID_FILE" "$WEB_LOG" || exit 1
  start_service "Admin" "pnpm --filter @eggturtle/admin dev" "$ADMIN_PID_FILE" "$ADMIN_LOG" || exit 1

  echo
  show_status
}

stop_all() {
  print_header "停止 Eggturtle SaaS 服务"
  stop_service "Admin" "$ADMIN_PID_FILE"
  stop_service "Web" "$WEB_PID_FILE"
  stop_service "API" "$API_PID_FILE"
}

show_status() {
  print_header "Eggturtle SaaS 服务状态"
  show_service_status "API" "$API_PID_FILE" "http://localhost:30011/health"
  show_service_status "Web" "$WEB_PID_FILE" "http://localhost:30010"
  show_service_status "Admin" "$ADMIN_PID_FILE" "http://localhost:30020"

  echo
  echo "日志文件:"
  echo "  API   : $API_LOG"
  echo "  Web   : $WEB_LOG"
  echo "  Admin : $ADMIN_LOG"
}

restart_all() {
  stop_all
  echo
  start_all
}

show_help() {
  cat <<'USAGE'
Eggturtle SaaS 本地开发管理脚本

用法:
  ./dev.sh start
  ./dev.sh stop
  ./dev.sh restart
  ./dev.sh status
  ./dev.sh help
USAGE
}

case "${1:-help}" in
start)
  start_all
  ;;
stop)
  stop_all
  ;;
restart)
  restart_all
  ;;
status)
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
