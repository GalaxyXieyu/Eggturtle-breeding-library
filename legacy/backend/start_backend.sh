#!/bin/bash

# Glam Cart Backend 后台启动脚本
# 使用nohup在后台运行服务，不依赖终端

echo "🚀 启动 Glam Cart Backend 服务..."

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ -d "venv" ]; then
    echo "📦 激活虚拟环境 (venv)..."
    source venv/bin/activate
else
    echo "⚠️ 警告: 未找到虚拟环境 (venv)，尝试直接运行..."
fi

# 设置生产环境变量
export DEBUG=False

# 使用nohup在后台启动服务
nohup python run.py > backend.log 2>&1 &

# 获取进程ID
PID=$!

# 保存PID到文件
echo $PID > backend.pid

echo "✅ 后端服务已启动"
echo "📍 进程ID: $PID"
echo "📝 日志文件: backend.log"
echo "🔧 PID文件: backend.pid"
echo ""
echo "查看日志: tail -f backend.log"
echo "停止服务: kill \$(cat backend.pid)"
echo "检查状态: ps -p \$(cat backend.pid)"
