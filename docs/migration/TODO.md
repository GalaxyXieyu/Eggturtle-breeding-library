# MIGRATION_TODO（迁移待办清单：按里程碑拆任务 + 依赖顺序）

更新日期：2026-02-28

目的：把 `docs/MIGRATION_API_MATRIX.md` + `docs/MIGRATION_UI_MATRIX.md` 里暴露出来的缺口，拆成可执行的迁移里程碑（Milestones），明确依赖顺序与验收口径。

原则

- 先补 Node 端数据模型 + API（apps/api + Prisma），再补入口页面（apps/web / apps/admin）。
- 先只读链路（列表/详情/查询），再写入链路（records/events），最后运营向（imports/settings/carousels）。
- 每个里程碑都要有：API acceptance（脚本或 matrix 条目）+ 最小 UI 验收入口。

---

## Milestone 0: Admin 平台基建收口（已基本完成）

状态：主线已具备（apps/admin session/proxy + tenants/memberships/audit logs）。

验收（Done 기준）

- apps/admin 可登录（super-admin allowlist）
- /dashboard/tenants, /dashboard/memberships, /dashboard/audit-logs 可用
- 所有调用都走 `/api/proxy/admin/*`，客户端不持久化 token

---

## Milestone 1: Series + Breeders 只读链路（替代 legacy 用户侧核心浏览）

目标：让 Node Web 出现可用入口，覆盖 legacy 的 `SeriesFeed` + `BreederDetail` 的核心浏览能力。

### 1.1 Prisma / Schema

- 新增 core tables（按 SaaS 口径 + legacy 字段做最小映射）
  - `series`
  - `breeders`
  - （可选）`breeder_relations` / `breeder_family_edges`（如果 family-tree 要做缓存）
  - `breeder_events`（先只读，写入在 Milestone 2）

### 1.2 API (apps/api)

对照 legacy：`/api/series`、`/api/breeders/*`

- GET `/series`（列表；支持 search/分页）
- GET `/series/:id`（详情；可带 breeders 计数/最近更新）
- GET `/breeders`（列表；支持 seriesId / search / code filter）
- GET `/breeders/by-code/:code`
- GET `/breeders/:id`（详情）
- GET `/breeders/:id/events`（只读 timeline；分页）
- GET `/breeders/:id/family-tree`（先做 1-hop/2-hop 简化版本也行）

验收

- 新增条目写入 `docs/spec/API_ACCEPTANCE_MATRIX.md`（对应模块 + 负例）
- `scripts/api-tests/*` 增加 series/breeders 场景，能跑出 PASS evidence

### 1.3 UI (apps/web)

- `/app/[tenantSlug]/series`：SeriesFeed（列表）
- `/app/[tenantSlug]/breeders`：Breeders 列表（可由 series 进入）
- `/app/[tenantSlug]/breeders/[breederId]`：BreederDetail（基础信息 + events + family-tree 占位/简版）

验收

- 入口可从现有 dashboard 导航进入（避免“有页无入口”）
- 至少 1 组 demo 数据可展示（seed 或 synthetic dataset 扩展）

---

## Milestone 2: Admin Records 写入链路（交配/产蛋/事件）

目标：补齐 legacy 的 admin 写入端点（mating/egg/events），并且所有写入可审计。

### 2.1 Schema

- `mating_records`
- `egg_records`
- `breeder_events`（如果 1.1 已建，这里补齐 type/metadata）

### 2.2 API (apps/api)

对照 legacy：`/api/admin/mating-records`、`/api/admin/egg-records`、`/api/admin/breeder-events`

- POST `/admin/mating-records`
- DELETE `/admin/mating-records/:id`
- POST `/admin/egg-records`
- DELETE `/admin/egg-records/:id`
- POST `/admin/breeder-events`

验收

- 每个写入都产生日志：`audit_logs`（actor/tenant/action/entityId/before/after/errorCode）
- 为每个写入接口补 API tests（含权限拒绝/字段校验）

### 2.3 UI 入口

两种路线二选一（先快后美）：

- Route A: apps/admin 增加内部页面（平台 admin）
  - `/dashboard/breeders/[id]/records`（简单表单 + 最近写入记录）
- Route B: apps/web 做 tenant-admin（更贴合最终产品）

验收

- 能在 UI 完成一次 mating/egg 写入，页面回显 audit log id

---

## Milestone 3: 运营向模块（imports/settings/carousels）

目标：补齐 legacy 运营后台中的“批量导入/设置/轮播”。

### 3.1 Imports

- GET `/admin/imports/template`
- POST `/admin/imports/products`（或 `/products/batch-import`）

验收

- dry-run 默认 + `--confirm` 写入开关
- 导入结果有 report（成功/失败/行号/原因）

### 3.2 Settings

- GET `/admin/settings`
- PUT `/admin/settings`

### 3.3 Carousels

- GET `/carousels`
- POST `/carousels`
- PUT `/carousels/:id`
- DELETE `/carousels/:id`

---

## Milestone 4: Legacy 下线准备

- Node 端覆盖率达到：Series/Breeders/Records/Imports/Settings/Carousels
- UI 入口完整（无“有接口无页面”）
- API acceptance matrix 全绿 + evidence harness 可复跑
- 迁移数据策略确认（legacy 数据导出/导入 or 双写期）
