# 阶段1: 构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci

# 复制前端源码
COPY frontend/ ./

# 构建前端（生产模式）
RUN npm run build

# 阶段2: 构建最终镜像
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（添加重试机制）
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc || \
    (sleep 5 && apt-get update && apt-get install -y --no-install-recommends gcc) && \
    rm -rf /var/lib/apt/lists/*

# 复制后端依赖文件
COPY backend/requirements.txt ./

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端源码
COPY backend/ ./

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

# 创建数据目录（用于挂载 PVC）
RUN mkdir -p /data/images

# 设置环境变量（生产环境通过 Sealos 覆盖）
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DEBUG=False
ENV DATABASE_URL=sqlite:////data/app.db
ENV UPLOAD_DIR=/data/images
ENV SECRET_KEY=change-this-in-production
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=admin123

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
