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

## 业务文档（字段与逻辑）

- 字段命名与业务规则（插件对接）：`docs/turtle-album/FIELD_NAMING_AND_BUSINESS_RULES.md`
- OpenClaw 上传技能规范：`skills/openclaw-product-upload.skill.md`
- OpenClaw 上传脚本：`scripts/openclaw_upload_product.py`

## 快速开始

### 方式一：使用开发脚本（推荐）

```bash
# 首次使用需要安装依赖
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..

# 启动开发环境（前端 + 后端）
./dev.sh start

# 查看服务状态
./dev.sh status

# 停止服务
./dev.sh stop

# 重启服务
./dev.sh restart
```

### 方式二：手动启动

**Backend:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/db_migrate.py upgrade
python run.py
```

默认使用：`backend/data/app.db`

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://localhost:8080`（如被占用会自动使用 8081；以 `./dev.sh status` / `/tmp/turtle-frontend.log` 显示为准）

## 关键约定

- 本地启动以 `./dev.sh` 为准（会同时拉起前后端，并自动处理端口占用）。
- 前端端口：默认 `http://localhost:8080`，如被占用会自动使用 `8081`（端口会写入 `/tmp/turtle-frontend.log`）。
- 后端端口：`http://localhost:8000`，健康检查：`http://localhost:8000/health`。
- 主数据库文件（dev）：`backend/data/app.db`。
- 数据库结构变更统一使用 Alembic，禁止再用“删库重建”作为常规流程。
- 生产环境：Docker 默认 `DATABASE_URL=sqlite:////data/app.db`（建议挂载 `/data` 做持久化）。
- 历史 DB 统一放 `backend/data/archive/`。
- 不要在仓库根目录或 `backend/` 根目录散落 `*.db`。

## 数据库迁移规范（Alembic）

```bash
cd backend

# 1) 同步到最新版本（开发/部署前都要执行）
python scripts/db_migrate.py upgrade

# 2) 生成迁移（修改 models 后）
python scripts/db_migrate.py revision --autogenerate -m "describe_change"

# 3) 回滚一个版本（需要时）
python scripts/db_migrate.py downgrade -1
```

- 已有历史 SQLite（未带 `alembic_version`）会在服务首次启动时自动桥接并标记 baseline。
- 首次桥接旧 SQLite 前会自动备份到 `backend/data/archive/`（生产容器对应 `/data/archive/`）。
- 新增 schema 变更必须提交 Alembic revision（`backend/alembic/versions/`）。
- 默认不会自动执行“删列”类破坏性 SQLite 迁移；如确需自动执行，设置 `AUTO_APPLY_DESTRUCTIVE_SQLITE_MIGRATIONS=true`。

## 截图/验证约定（避免误会）

- 任何“本地效果截图”都必须基于 `./dev.sh start` 启动后的前端端口（8080/8081），不要用临时的 5173。
- 截图前先人工打开页面确认一次，再上传图床发 URL。

## 常用命令

```bash
# Frontend
cd frontend && npm run lint
cd frontend && npm run build

# Backend
cd backend && python scripts/db_migrate.py upgrade
cd backend && python -m pytest tests/ -v
```

## 部署

- Docker 镜像默认 `DATABASE_URL=sqlite:////data/app.db`
- 推荐生产环境挂载 `/data`（持久化 DB 与上传图片）
- CI 默认启用 `/data` PVC 强校验（`REQUIRE_DATA_PVC=true`），未挂 PVC 会阻止发布
