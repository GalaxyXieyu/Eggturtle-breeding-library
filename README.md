# Eggturtle Breeding Library

多租户 SaaS 产品系统（Node.js/TypeScript Monorepo）。

当前主线：`apps/api + apps/web + apps/admin`。  
Legacy 代码已归档到：`legacy/backend`、`legacy/frontend`（不作为当前运行主线）。

## 仓库结构

```text
Eggturtle-breeding-library/
├── apps/
│   ├── api/                 # NestJS API
│   ├── web/                 # Next.js 租户端
│   └── admin/               # Next.js 平台后台
├── packages/
│   └── shared/              # 共享类型/契约
├── scripts/                 # 启动、测试、迁移脚本
├── docs/                    # 项目文档（已收敛到根模板 + plan/evidence/payment）
└── legacy/
    ├── backend/             # Legacy FastAPI（归档）
    └── frontend/            # Legacy React（归档）
```

## 文档入口

- 文档总入口：`docs/README.md`
- 主模板总报告：`docs/report.md`
- UI 规范：`docs/UI_STYLE_GUIDE.md`

## 本地开发（SaaS 主线）

### 1) 安装依赖

```bash
pnpm -r install
```

### 2) 配置 API 环境变量

```bash
cp apps/api/.env.example apps/api/.env
```

### 3) 数据库迁移与种子

```bash
pnpm --filter @eggturtle/api prisma:migrate
pnpm --filter @eggturtle/api prisma:seed
```

### 4) 启动服务

推荐一键启动（会同时启动 API/Web/Admin）：

```bash
# 等价于 ./dev.sh start（内置 restart 逻辑：先 stop 再 start）
pnpm dev:start
```

停止/查看状态：

```bash
pnpm dev:stop
pnpm dev:status
```

`pnpm dev:*` 底层使用 `./dev.sh`。需要直接执行脚本时可用：

```bash
./dev.sh start  # 启动全部服务（内置 restart：先停后启）
./dev.sh stop   # 停止全部服务
./dev.sh status # 查看服务与健康检查状态
```

若出现前端无样式或缓存异常，可在启动时附加清理：

```bash
CLEAN_ON_START=1 ./dev.sh start
```

常用环境变量（按需覆盖默认检查）：

```bash
API_HEALTH_URL=http://127.0.0.1:30011/health ./dev.sh start
WEB_HEALTH_URL=http://127.0.0.1:30010/login ./dev.sh start
ADMIN_HEALTH_URL=http://127.0.0.1:30020/login ./dev.sh start
WEB_CSS_CHECK_URL=http://127.0.0.1:30010/_next/static/css/app/layout.css ./dev.sh start
SKIP_WEB_ASSET_CHECK=1 ./dev.sh start # 跳过 CSS 资源探测
```

也可分别启动：

```bash
# API
pnpm --filter @eggturtle/api dev

# Web
pnpm --filter @eggturtle/web dev

# Admin（按需）
pnpm --filter @eggturtle/admin dev
```

默认端口（本地）：
- API: `http://localhost:30011`
- Web: `http://localhost:30010`
- Admin: `http://localhost:30020`

## 构建与检查

```bash
pnpm -r lint
pnpm -r build
```

## 容器部署

SaaS 镜像使用：`Dockerfile.node`。

```bash
docker build -f Dockerfile.node -t eggturtle-node:local .
```

## 重要说明

- `legacy/*` 仅作历史归档，不作为当前业务主线。
- 新功能与修复默认在 `apps/*` 与 `packages/*` 实现。
