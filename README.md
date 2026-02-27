# Eggturtle Breeding Library（蛋龟选育库）

一个面向蛋龟繁育者的种龟管理与对外展示系统。当前仓库包含 Legacy 实现（React + FastAPI），并计划重构为 **Node.js/TypeScript 全栈 SaaS**（见 `docs/SAAS_REQUIREMENTS.md`）。

## 项目结构

```text
Eggturtle-breeding-library/
├── frontend/                 # Vite + React + TypeScript
├── backend/                  # FastAPI + SQLAlchemy（Legacy）
│   ├── app/                  # API / models / schemas / db
│   ├── scripts/              # DB 初始化与导入脚本
│   ├── data/                 # 运行时 sqlite 目录（git 忽略 DB 文件）
│   │   ├── app.db
│   │   └── archive/
│   └── static/               # 图片等静态资源
├── docs/                     # 方案与实现文档
└── Dockerfile
```

## 文档入口

- SaaS 需求与架构口径（Node.js 全栈）：`docs/SAAS_REQUIREMENTS.md`
- 现有系统概况（Legacy，总结用）：`docs/SYSTEM_OVERVIEW.md`
- 接口一览（按功能分组）：`docs/API_OVERVIEW.md`
- 接口详细口径与设计原因：`docs/API_SPEC.md`

历史/旧业务文档已归档到 `docs/_archive/`。

## 快速开始

### 方式零：Docker 本地启动（推荐，少装环境）

我们约定本地所有对外端口都用 `30000+`：
- App: `30080`
- Postgres: `30001`
- MinIO(S3): `30002`
- MinIO(Console): `30003`

方式 A：直接跑单体镜像（只用 sqlite，最快）

```bash
cd /Volumes/DATABASE/code/Eggturtle-breeding-library

docker build -t eggturtle:local .
mkdir -p .data

docker run --rm \
  -p 30080:80 \
  -v "$(pwd)/.data:/data" \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin123 \
  eggturtle:local
```

方式 B：docker compose（同时起 App + Postgres + MinIO，便于后续 SaaS 化）

```bash
cd /Volumes/DATABASE/code/Eggturtle-breeding-library
mkdir -p .data

docker compose -f docker-compose.local.yml up --build
```

访问：
- Web（前端 + API 同域）：`http://localhost:30080`
- API docs：`http://localhost:30080/docs`
- Health：`http://localhost:30080/health`
- Postgres：`localhost:30001`
- MinIO：`http://localhost:30003`（console） / `http://localhost:30002`（S3 API）

说明：
- Legacy app 目前仍使用本地磁盘图片（`/data/images`）+ sqlite 默认库；MinIO/Postgres 是为后续 Node SaaS 预留。
- 生产环境请务必覆盖 `SECRET_KEY/ADMIN_PASSWORD` 等变量。

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

### Node dev（new）

> 以下为新的 Node.js/TypeScript monorepo（与 legacy 并存，不替换 `frontend/`、`backend/`）。

```bash
cd /Volumes/DATABASE/code/Eggturtle-breeding-library

# 安装 workspace 依赖
pnpm -r install

# API 使用本地 Postgres（docker compose 对应 30001）
cp apps/api/.env.example apps/api/.env

# 执行 Prisma 迁移 + 初始化种子数据
pnpm --filter @eggturtle/api prisma:migrate
pnpm --filter @eggturtle/api prisma:seed

# 代码检查与构建
pnpm -r lint
pnpm -r build

# 启动新 API（NestJS）
pnpm --filter @eggturtle/api dev

# 启动新 Web（Next.js App Router）
pnpm --filter @eggturtle/web dev
```

默认端口：
- New Web：`http://localhost:30010`
- New API：`http://localhost:30011/health`
- New API DB 健康检查：`http://localhost:30011/health/db`

可选环境变量：
- `apps/api/.env.example`（默认 `DATABASE_URL=postgres://eggturtle:eggturtle@localhost:30001/eggturtle`）
- `NEXT_PUBLIC_API_BASE_URL`（web 访问 API 的基地址，默认 `http://localhost:30011`）

### Auth v0（邮箱验证码）最小验证

```bash
# 1) 迁移（等价于 pnpm --filter @eggturtle/api prisma:migrate）
pnpm -C apps/api prisma:migrate

# 2) 请求验证码（development 环境会在响应 devCode + 控制台日志输出验证码）
curl -s http://localhost:30011/auth/request-code \
  -H 'content-type: application/json' \
  -d '{"email":"demo@eggturtle.local"}'

# 3) 校验验证码并换取 accessToken
curl -s http://localhost:30011/auth/verify-code \
  -H 'content-type: application/json' \
  -d '{"email":"demo@eggturtle.local","code":"<6-digit-code>"}'

# 4) 调用 /me
curl -s http://localhost:30011/me \
  -H 'authorization: Bearer <accessToken>'
```

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
