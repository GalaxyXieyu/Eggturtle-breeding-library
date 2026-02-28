# Codebase Structure（仓库代码架构梳理）

更新日期：2026-02-27

本仓库目前处于“**Legacy 版本仍可运行** + **Node.js/TypeScript 全栈 SaaS 重构中**”的过渡期，所以会同时看到 Python、Vite 前端、以及新的 Next/Nest 代码。

## 1. 两条实现并存（先把这点认知定死）

### 1.1 Legacy（来自原 TurtleAlbum 的 React + FastAPI）

用途：现网可跑 / 作为功能参考 / 迁移对照。

- `backend/`：FastAPI + SQLAlchemy + Alembic（Python）
- `frontend/`：Vite + React（TypeScript）
- `dev.sh`：启动/停止 Legacy（后端 8000 + 前端 8080/8081）
- `Dockerfile`：构建并打包 Legacy（前端 dist + Python 后端），容器内跑 uvicorn
- `docker-compose.local.yml`：主要也是为 Legacy（并预留 Postgres/MinIO 等）

结论：你看到的 `backend/` + `frontend/` 并不是“没迁移进去”，它们就是 Legacy 版本本体。

### 1.2 Node 重构（目标：纯 Node.js/TypeScript 的 SaaS）

用途：未来的主线实现（对齐 `docs/SAAS_REQUIREMENTS.md`）。

- `apps/api/`：NestJS API（TypeScript）+ Prisma
- `apps/web/`：Next.js（面向租户 App，登录后）
- `apps/admin/`：Next.js（平台/运营后台）
- `packages/shared/`：共享 DTO/schema/常量（zod 等）
- `scripts/api-tests/`：新 API 的 TS 测试脚本（pnpm workspace）

结论：现在的“纯 Next”是指 `apps/web`、`apps/admin` 这套；它和 `frontend/` 没有互相“包含/合并”的关系。

## 2. 一眼看懂：目录对应什么

```text
Eggturtle-breeding-library/
  apps/                 # 新：Node 全栈（主线重构）
    api/                # NestJS + Prisma
    web/                # Next.js
    admin/              # Next.js
  packages/
    shared/             # 共享类型/DTO/校验

  frontend/             # 旧：Vite React（Legacy）
  backend/              # 旧：FastAPI（Legacy）

  docs/                 # 需求/口径/规格
  scripts/              # 混合：历史 Python 脚本 + 新的 TS 测试
  dev.sh                # 旧：只负责启动 Legacy
  Dockerfile            # 旧：只打包 Legacy
  pnpm-workspace.yaml   # 新：pnpm workspace（apps/* + packages/* + frontend）
```

备注：`pnpm-workspace.yaml` 目前也把 `frontend/` 加进 workspace，原因是 Dockerfile 用 pnpm + lockfile 来构建 legacy 前端；这不代表 legacy 前端已经迁移到 Next。

## 3. 当前应该怎么“理解/使用”

### 3.1 如果你现在要继续维护现网（Legacy）

- 启动：`./dev.sh start`
- 开发位置：`frontend/` + `backend/`
- 构建/部署：走根目录 `Dockerfile`

### 3.2 如果你现在要推进 SaaS 重构（Node 主线）

- 入口文档：`docs/SAAS_REQUIREMENTS.md`
- 开发位置：`apps/api` + `apps/web` + `apps/admin` + `packages/shared`
- 启动方式：用 pnpm（详见根目录 `README.md` 的 Node dev（new）段落）

## 4. 现在的“混乱感”来自哪里（以及怎么收敛）

现状混乱点：
- `dev.sh` / `Dockerfile` / `docker-compose.local.yml` 默认指向 Legacy
- Node 主线已经有 `apps/*`，但还没替换掉 Legacy 的启动/部署链路

建议收敛策略（需你确认后再动）：
1) 先定主线：是否从今天开始“功能只在 Node 主线做”？
2) 目录收纳：把 `frontend/`、`backend/` 迁到 `legacy/frontend`、`legacy/backend`（或 `_legacy/`）避免误操作
3) 启动脚本：补一个 `dev-node.sh`（或扩展现有 `dev.sh` 增加 `start-node`）
4) 部署链路：新增 `Dockerfile.node` / `docker-compose.node.yml`，并明确哪个对应 prod

如果你回复“主线以 Node 为准”，我下一步可以把这些收敛动作拆成一个非常明确的 checklist（不破坏现有 legacy 可运行性）。
