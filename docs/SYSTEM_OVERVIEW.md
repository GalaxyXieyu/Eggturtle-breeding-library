# Current System Overview（现有系统概况）

更新日期：2026-02-26

目的：在开始全量 Node.js/TypeScript 重构前，先把“现有系统怎么跑、有哪些服务、核心业务逻辑在哪里、接口怎么分组”梳理清楚，避免重构时漏功能。

> 备注：本文描述的是当前仓库 `/Volumes/DATABASE/code/Eggturtle-breeding-library` 的现状（Legacy: React + FastAPI）。未来目标形态见 `docs/SAAS_REQUIREMENTS.md`。

## 1. 服务与运行形态

### 1.1 组件

- Frontend：`frontend/`（Vite + React + TypeScript）
- Backend：`backend/`（FastAPI + SQLAlchemy + Alembic）
- Database：开发默认 SQLite（`backend/data/app.db`），也支持 `DATABASE_URL` 指向 Postgres
- Static/Images：默认 `backend/static/images`，并在 API 中挂载 `/images` 与 `/static`

### 1.2 关键端口与健康检查

- Backend：`http://localhost:8000`
  - health：`GET /health`
  - swagger：`/docs`
- Frontend：默认 `http://localhost:8080`（被占用则 8081；以 `./dev.sh status` 为准）

### 1.3 启动入口

- 推荐：仓库根目录 `./dev.sh start`
- Backend 手动：`python run.py`（并先执行 `python scripts/db_migrate.py upgrade`）

### 1.4 Node rebuild（new）

> 新增 Node.js/TypeScript monorepo 骨架，当前与 legacy 并存。

- Workspace 根：`package.json` + `pnpm-workspace.yaml`
- New Web：`apps/web`（Next.js App Router + TypeScript）
  - dev：`pnpm --filter @eggturtle/web dev`（默认 `http://localhost:30010`）
  - 页面入口：`apps/web/app/page.tsx`
  - API 代理入口：`apps/web/app/api/health/route.ts`
- New API：`apps/api`（NestJS + TypeScript）
  - dev：`pnpm --filter @eggturtle/api dev`（默认 `http://localhost:30011`）
  - 健康检查：`GET /health`（实现见 `apps/api/src/health.controller.ts`）
  - 环境变量示例：`apps/api/.env.example`
- Shared Package：`packages/shared`（共享类型、zod schema、错误码）

## 2. 后端架构与核心模块

### 2.1 FastAPI 入口与路由挂载

- 入口：`backend/app/main.py`
- 路由分组（include_router）：
  - `/api/auth`（admin 登录）
  - `/api/products`（产品/后台产品管理）
  - `/api/products/batch-import`（导入）
  - `/api/series`（系列）
  - `/api/breeders`（种龟相关公共接口）
  - `/api/admin/*`（后台系列/记录/事件）
  - `/api/carousels` `/api/featured-products` `/api/settings`

> 更完整接口清单见 `docs/API_OVERVIEW.md`。

### 2.2 数据与迁移

- SQLAlchemy models：`backend/app/models/models.py`
- Pydantic schemas：`backend/app/schemas/schemas.py`
- DB session/config：`backend/app/db/session.py`
- Alembic：`backend/alembic/` + `backend/scripts/db_migrate.py`

### 2.3 业务服务层（services）

- 编号/字段归一：`backend/app/services/code_normalize.py`
- 自然排序字段：`backend/app/services/code_sort_fields.py`
- 配偶/换公逻辑：`backend/app/services/breeder_mate.py`
- 导入：`backend/app/services/import_service.py`

### 2.4 静态资源与图片

- `UPLOAD_DIR` 环境变量控制上传目录（默认 `static/images`）
- API 挂载：
  - `/static` -> `STATIC_DIR`
  - `/images` -> `UPLOAD_DIR`

> 现有实现是“本地磁盘静态文件”。SaaS 目标是切到 MinIO（S3 compatible）并使用短期 Signed URL（见 `docs/SAAS_REQUIREMENTS.md`）。

## 3. 现有业务对象（抽象层级）

- Product（产品/种龟档案，包含 code/description/series/sex/price/images 等）
- Series（系列）
- Breeder（种龟详情聚合视图：按 series + sex + code 等维度展示，并包含记录/事件/族谱聚合）
- Breeder events / records（交配/产蛋/换公等结构化记录）

> 字段/业务规则的历史文档在 `docs/_archive/`，后续重构以 `docs/SAAS_REQUIREMENTS.md` 为准。

## 4. 重构到 Node.js 时的“对齐清单”（只列需要保留的能力）

- Public：系列/种龟列表与详情、图片展示
- Admin：基础登录、产品 CRUD、图片追加/删除/重排、系列管理
- Records：交配/产蛋/换公记录（以及事件时间线能力）
- 导入：batch import 模板 + 导入接口
- 运维：健康检查、迁移、备份/恢复策略（SaaS）
