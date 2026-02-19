# Turtle Album

一个基于 React + FastAPI 的种龟展示与管理系统，聚焦系列、种公/种母、交配记录、下蛋记录与后台维护。

## 项目结构

```text
turtle_album/
├── frontend/                 # Vite + React + TypeScript
├── backend/                  # FastAPI + SQLAlchemy
│   ├── app/                  # API / models / schemas / db
│   ├── scripts/              # DB 初始化与导入脚本
│   ├── data/                 # 运行时 sqlite 目录（git 忽略 DB 文件）
│   │   ├── app.db
│   │   └── archive/
│   └── static/               # 图片等静态资源
├── docs/                     # 方案与实现文档
└── Dockerfile
```

## 快速开始

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

默认使用：`backend/data/app.db`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://localhost:5173`

## 关键约定

- 主数据库文件：`backend/data/app.db`
- 生产环境可通过 `DATABASE_URL` 覆盖
- 历史 DB 统一放 `backend/data/archive/`
- 不再在仓库根目录或 `backend/` 根目录散落 `*.db`

## 常用命令

```bash
# Frontend
cd frontend && npm run lint
cd frontend && npm run build

# Backend
cd backend && python -m pytest tests/ -v
```

## 部署

- Docker 镜像默认 `DATABASE_URL=sqlite:////data/app.db`
- 推荐生产环境挂载 `/data`（持久化 DB 与上传图片）

