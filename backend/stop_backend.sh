#!/bin/bash

# Glam Cart Backend 停止脚本

echo "🛑 停止 Glam Cart Backend 服务..."

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查PID文件是否存在
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    
    # 检查进程是否还在运行
    if ps -p $PID > /dev/null 2>&1; then
        echo "📍 找到进程 $PID，正在停止..."
        kill $PID
        
        # 等待进程结束
        sleep 2
        
        # 检查是否成功停止
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️  进程未能正常停止，强制终止..."
            kill -9 $PID
        fi
        
        echo "✅ 服务已停止"
    else
        echo "⚠️  进程 $PID 不存在或已停止"
    fi
    
    # 删除PID文件
    rm -f backend.pid
else
    echo "⚠️  未找到 backend.pid 文件"
    echo "尝试查找并停止所有相关进程..."
    
    # 查找并停止所有相关的Python进程
    pkill -f "python run.py"
    echo "✅ 已尝试停止所有相关进程"
fi

echo "🏁 停止操作完成"
