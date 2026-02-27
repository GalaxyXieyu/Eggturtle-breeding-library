# 阶段1: 构建前端（pnpm + workspace lockfile）
FROM node:20-alpine AS frontend-builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

# 先复制 lockfile 与前端 package.json，保证依赖安装可缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json

# 仅安装 legacy frontend 依赖，且强制使用锁文件
RUN pnpm install --filter ./frontend... --frozen-lockfile

# 复制前端源码并构建生产产物
COPY frontend/ ./frontend/
RUN pnpm --dir frontend run build

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
ENV PORT=80
ENV DEBUG=False
ENV DATABASE_URL=sqlite:////data/app.db
ENV UPLOAD_DIR=/data/images
ENV SECRET_KEY=__SET_IN_DEPLOYMENT_ENV__
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=__SET_IN_DEPLOYMENT_ENV__

# 暴露端口
EXPOSE 80

# 启动命令
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
