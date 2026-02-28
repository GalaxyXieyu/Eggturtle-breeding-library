# Migration Coverage Audit（Legacy -> Node 重构覆盖检查）

更新日期：2026-02-27

本文件用于回答两个问题：

1) 新租户端（`apps/web`）是否已覆盖 legacy 前端（`frontend/`）核心功能？
2) 新 API（`apps/api`）是否已覆盖 legacy FastAPI（`backend/`）接口？

结论先写在最前面：

- 目前 **未覆盖**。新租户端/新 API 仍处于 v0 骨架阶段，只覆盖了：邮箱验证码登录、多租户切换、产品与图片、featured-products、share 公共只读页、平台级 tenants/members/audit。
- Legacy 的核心“种龟（breeders）+ 事件（mating/egg/events）+ 谱系（family-tree）+ 系列/轮播/设置/批量导入”等，尚未在 Node 主线看到同等覆盖。

因此：现在不建议把 `backend/` + `frontend/` 直接归档/移走（会丢功能/丢接口）。建议先做“安全归档（不改行为的重命名/收纳）”，等覆盖补齐再切换部署链路。

---

## 1. Legacy 前端页面（`frontend/src/pages`）

核心用户侧页面：
- `frontend/src/pages/SeriesFeed.tsx`：系列流/展示入口
- `frontend/src/pages/BreederDetail.tsx`：种龟详情（血缘/父母/祖代/子代/事件等的入口）
- `frontend/src/pages/NotFound.tsx`

Legacy 管理后台页面（单体前端内的 admin 区）：
- `frontend/src/pages/admin/AdminLogin.tsx`
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminProducts.tsx`（产品/图片/排序/批量导入等）
- `frontend/src/pages/admin/AdminSeries.tsx`
- `frontend/src/pages/admin/AdminFeaturedProducts.tsx`
- `frontend/src/pages/admin/AdminCarouselManager.tsx`
- `frontend/src/pages/admin/AdminSettings.tsx`

Admin 子组件（与“批量导入/种龟事件/图片管理”强相关）：
- `frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`
- `frontend/src/pages/admin/products/images/ProductImagesManager.tsx`
- 以及 `frontend/src/pages/admin/products/*` 下的一系列列表/表格/表单组件

### 1.1 Legacy 前端依赖的 API（从 `frontend/src/services` 观察）

Legacy 产品侧（示例）：
- `frontend/src/services/productService.ts`
  - `/api/products`
  - `/api/products/batch-import`（批量导入）
  - `/api/products/batch-import/template`（下载模板）

Legacy 种龟侧（示例）：
- `frontend/src/services/turtleAlbumService.ts`
  - `/api/series`
  - `/api/admin/series`
  - `/api/admin/breeder-events`
  - `/api/breeders`
  - `/api/breeders/by-code/{code}`
  - `/api/breeders/{id}`
  - `/api/breeders/{id}/records`
  - `/api/breeders/{id}/events`
  - `/api/breeders/{id}/mate-load`
  - `/api/breeders/{id}/family-tree`

---

## 2. Legacy FastAPI 路由组（`backend/app/main.py` include_router）

Legacy 全部使用 `/api/...` 前缀。当前挂载如下：

- `/api/auth`（Auth）
- `/api/products`（Products）
- `/api/products`（Admin Products，legacy 也挂在 products 下）
- `/api/products/batch-import`（Imports）
- `/api/carousels`（Carousels）
- `/api/featured-products`（Featured Products）
- `/api/settings`（Settings）
- `/api/series`（Series）
- `/api/breeders`（Breeders：种龟/事件/谱系核心）
- `/api`（Images：/images/{filename}）
- `/api/admin/series`（Admin Series）
- `/api/admin`（Admin Records：mating-records/egg-records/breeder-events 等）

### 2.1 Legacy 主要 endpoint 轮廓（按 router 文件提取）

- `backend/app/api/routers/auth.py`
  - POST `/login`, POST `/logout`, GET `/verify`

- `backend/app/api/routers/products.py`
  - GET `/featured`, GET `/filter-options`, GET `/`, GET `/{product_id}`

- `backend/app/api/routers/imports.py`
  - GET `/template`, POST `/` （都在 `/api/products/batch-import` 下）

- `backend/app/api/routers/series.py`
  - GET `/` （在 `/api/series` 下）

- `backend/app/api/routers/breeders.py`
  - GET `/`（列表）
  - GET `/by-code/{code}`
  - GET `/{breeder_id}`
  - GET `/{breeder_id}/records`
  - GET `/{breeder_id}/events`
  - GET `/{breeder_id}/mate-load`
  - GET `/{breeder_id}/family-tree`

- `backend/app/api/routers/admin_records.py`（在 `/api/admin` 下）
  - POST `/mating-records`, DELETE `/mating-records/{record_id}`
  - POST `/egg-records`, DELETE `/egg-records/{record_id}`
  - POST `/breeder-events`

- `backend/app/api/routers/admin_series.py`（在 `/api/admin/series` 下）
  - GET `/`, POST `/`, PUT `/{series_id}`, DELETE `/{series_id}`

- `backend/app/api/routers/carousels.py`（在 `/api/carousels` 下）
  - GET `/`, POST `/`, PUT `/{carousel_id}`, DELETE `/{carousel_id}`

- `backend/app/api/routers/featured.py`（在 `/api/featured-products` 下）
  - GET `/`, POST `/`, PUT `/{featured_id}`, DELETE `/{featured_id}`

- `backend/app/api/routers/settings.py`（在 `/api/settings` 下）
  - GET `/`, PUT `/`

- `backend/app/api/routers/admin.py`（在 `/api/products` 下）
  - POST `/`（create product）
  - PUT `/{product_id}`
  - DELETE `/{product_id}`
  - POST `/{product_id}/images`
  - DELETE `/{product_id}/images/{image_id}`
  - PUT `/{product_id}/images/{image_id}/set-main`
  - PUT `/{product_id}/images/reorder`

---

## 3. 新租户端（Next：`apps/web`）现有路由

从 `apps/web/app/**/page.tsx` 实际文件统计：

- `/` -> `apps/web/app/page.tsx`（redirect 到 /app）
- `/login` -> `apps/web/app/login/page.tsx`（邮箱验证码登录）
- `/tenant-select` -> `apps/web/app/tenant-select/page.tsx`（选择/创建 tenant）
- `/app` -> `apps/web/app/app/page.tsx`（根据 token resolve tenant 并跳转）
- `/app/[tenantSlug]` -> `apps/web/app/app/[tenantSlug]/page.tsx`（tenant-scoped v0 dashboard，展示 /me）
- `/app/[tenantSlug]/tenants` -> `apps/web/app/app/[tenantSlug]/tenants/page.tsx`（tenant 管理页）
- `/app/[tenantSlug]/featured-products` -> `apps/web/app/app/[tenantSlug]/featured-products/page.tsx`
- `/app/tenants` -> `apps/web/app/app/tenants/page.tsx`（redirect 到 /tenant-select）
- `/public/share` -> `apps/web/app/public/share/page.tsx`（public share demo）
- `/admin` -> `apps/web/app/admin/page.tsx`（提示 admin moved 到 apps/admin）

结论：目前没有 legacy 的种龟/谱系/事件等页面，所以租户端功能远未覆盖 legacy。

---

## 4. 新平台后台（Next：`apps/admin`）现有路由

从 `apps/admin/app/**/page.tsx` 统计：

- `/` -> `apps/admin/app/page.tsx`
- `/login` -> `apps/admin/app/login/page.tsx`
- `/dashboard` -> `apps/admin/app/dashboard/page.tsx`
- `/dashboard/tenants` -> `apps/admin/app/dashboard/tenants/page.tsx`
- `/dashboard/tenants/[tenantId]` -> `apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`
- `/dashboard/memberships` -> `apps/admin/app/dashboard/memberships/page.tsx`
- `/dashboard/audit-logs` -> `apps/admin/app/dashboard/audit-logs/page.tsx`

结论：新 admin 是 SaaS 平台级（tenant/user/audit），不是 legacy 那种“产品/种龟/系列/轮播”运营后台。

---

## 5. 新 API（Nest：`apps/api`）现有 endpoint

注意：新 API 目前 **没有** `/api` 全局前缀，base URL 形态是 `http://localhost:30011/<path>`。

已存在 controller（从装饰器提取）：

- Health：
  - GET `/health`
  - GET `/health/db`

- Auth（`@Controller('auth')`）：
  - POST `/auth/request-code`
  - POST `/auth/verify-code`
  - POST `/auth/switch-tenant`

- Me（`@Controller()`）：
  - GET `/me`

- Tenants（`@Controller('tenants')`）：
  - POST `/tenants`
  - GET `/tenants/me`
  - GET `/tenants/current`

- Products（`@Controller('products')`）：
  - POST `/products`
  - GET `/products`
  - POST `/products/:id/images`
  - GET `/products/:pid/images/:iid/content`
  - DELETE `/products/:pid/images/:iid`
  - PUT `/products/:pid/images/:iid/main`
  - PUT `/products/:pid/images/reorder`

- Featured products（`@Controller('featured-products')`）：
  - GET `/featured-products`
  - POST `/featured-products`
  - DELETE `/featured-products/:id`
  - PUT `/featured-products/reorder`

- Public featured products（`@Controller('products')`）：
  - GET `/products/featured`

- Shares（`@Controller()`）：
  - POST `/shares`
  - GET `/s/:shareToken`
  - GET `/shares/:shareId/public`

- Audit logs（`@Controller('audit-logs')`）：
  - GET `/audit-logs`

- Admin（`@Controller('admin')`）：
  - GET `/admin/tenants`
  - GET `/admin/tenants/:tenantId`
  - POST `/admin/tenants`
  - GET `/admin/users`
  - GET `/admin/tenants/:tenantId/members`
  - POST `/admin/tenants/:tenantId/members`
  - GET `/admin/audit-logs`

---

## 6. 覆盖差距（Legacy vs Node 主线）

### 6.1 Legacy 已有，但 Node 主线缺失（高优先级缺口）

租户端/业务核心：
- 种龟（`/api/breeders/*`）
- 种龟事件/记录（`/api/breeders/{id}/events`，`/api/admin/mating-records`、`/api/admin/egg-records`、`/api/admin/breeder-events`）
- 谱系/家谱树（`/api/breeders/{id}/family-tree`）
- mate-load（配偶加载视图/任务视图支撑）
- series（`/api/series` + `/api/admin/series`）
- carousels（`/api/carousels`）
- settings（`/api/settings`）
- imports（`/api/products/batch-import`）

路径口径差异（迁移时需统一）：
- Legacy: `/api/...`；Node: `/<module>...`（目前无全局 `/api` 前缀）
- Legacy auth: `/api/auth/login`；Node auth: `/auth/request-code`（完全不同的认证模式）

### 6.2 Node 主线已做，但 Legacy 未必对应（新能力）

- 多租户 token-scoped + switch-tenant（Legacy 没有 SaaS tenant 这一层）
- 平台级 admin（租户/成员/audit）

### 6.3 覆盖矩阵（按模块汇总，便于一眼判断能不能停 legacy）

| 模块 | Legacy（frontend/backend） | Node API（apps/api） | Node Web/Admin（apps/web + apps/admin） | 覆盖状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 登录/鉴权 | `/api/auth/login`（账号密码）+ token | `/auth/request-code` `/auth/verify-code`（邮箱验证码） | 两端都有 login 页 | 部分覆盖（但机制不同） | 迁移时要选定统一的 auth 模式，或做兼容层 |
| 租户/多租户 | 基本没有 tenant 概念 | `/tenants/*` + `/auth/switch-tenant` + `/me` tenant-scoped token | `/tenant-select` `/app/[tenantSlug]`；admin 有 tenants/memberships | Node 新增能力 | legacy 数据迁移必须引入 tenant_id 归属 |
| 产品（列表/详情） | `/api/products` `/api/products/{id}` + admin products CRUD | `/products`（list/create）+ images 管理 | web 只做了 v0（featured、tenant 管理），没看到完整产品管理 UI | API 基本覆盖；UI 不完整 | legacy 还有 filter-options、更多筛选/排序语义 |
| 产品图片 | legacy admin `/api/products/{id}/images*` + `/api/images/{filename}` | `/products/:id/images` + `/products/:pid/images/:iid/content` | public share 页能展示图片 | 覆盖但路径差异大 | Node 走 imageId/content；legacy 走 filename 静态 |
| Featured products | `/api/featured-products/*` | `/featured-products/*` + `/products/featured`（public） | web 有 `featured-products` 页 | 基本覆盖 | 需要确认字段/排序语义一致 |
| 分享（share） | legacy 未见同等模块 | `/shares` `/shares/:id/public` `/s/:shareToken` | `/public/share` demo 页 | Node 新增能力 | 与证书/公开页路线可能可复用 |
| Series（系列） | `/api/series` + `/api/admin/series`，前端有 SeriesFeed | 暂无 | 暂无 | 缺失 | 属于核心导航/分类能力 |
| Breeders（种龟/谱系） | `/api/breeders/*` + BreederDetail | 暂无 | 暂无 | 缺失（核心） | 这是你现阶段“不能停 legacy”的最大原因 |
| 事件/记录（交配/产蛋/换公等） | `/api/breeders/{id}/events` + `/api/admin/mating-records` `/egg-records` `/breeder-events` | 暂无 | 暂无 | 缺失（核心） | 与 SaaS 需求中的“结构化事件表”直接相关 |
| Carousels（轮播） | `/api/carousels/*` + AdminCarouselManager | 暂无 | 暂无 | 缺失 | 可后置，但 legacy 有 |
| Settings（设置） | `/api/settings` + AdminSettings | 暂无 | 暂无 | 缺失 | 通常会影响全局展示/运营 |
| 批量导入 | `/api/products/batch-import` + template 下载 | 暂无 | 暂无 | 缺失 | legacy admin 强依赖 |
| 平台审计/成员 | legacy 未见 | `/audit-logs` + `/admin/*` | admin 端有 audit/memberships | Node 新增能力 | SaaS 平台治理向 |

---

## 7. 是否可以归档 Legacy？建议

当前建议：

- 不建议“删/移走” legacy（风险：功能缺失）。
- 但可以做“**安全归档/收纳**”（不改变行为）：把 legacy 标记清楚、降低误操作概率。

### 7.1 安全归档方案（不影响现有运行/部署）

在你确认后再做（建议一次 PR/一次提交）：

1) 目录收纳（只改路径不改内容）：
- `frontend/` -> `legacy/frontend/`
- `backend/` -> `legacy/backend/`

2) 同步更新引用：
- `dev.sh` 里 FRONTEND_DIR/BACKEND_DIR
- 根目录 `Dockerfile` 的 COPY 路径
- `README.md` 里的 quickstart 路径
- `pnpm-workspace.yaml`（如果 Dockerfile 仍用 pnpm 构建 legacy 前端，需要更新 workspace entry）

3) 明确新主线启动入口：
- 新增 `dev-node.sh` 或扩展 `dev.sh` 增加 `start-node/status-node`（不与 legacy 混用）

4) 部署链路分离（降低误部署）：
- 保留现有 `Dockerfile` 作为 legacy
- 新增 `Dockerfile.node` / `docker-compose.node.yml` 专门用于 `apps/*`

### 7.2 何时可以真正停用 legacy

- 当 `apps/api` 覆盖上面 6.1 的缺口（尤其 breeders/events/family-tree）
- 当 `apps/web` 有对应的种龟列表/详情/事件时间线/分享页/证书页
- 并且至少完成一次数据迁移/兼容层设计（tenant_id 这层如何处理 legacy 数据）

---

## 8. 推荐的迁移顺序（尽量最小闭环）

如果目标是“尽快让 Node 端能跑出一个可用闭环”，建议按下面顺序补：

1) 确认口径：Node 端是否也要保留 legacy 的“管理员账号密码登录”，还是统一走邮箱验证码。
2) 先补 API：`series` -> `breeders`（列表/详情）-> `breeder events/records` -> `family-tree`。
3) 再补 Web：种龟列表/详情/事件时间线（先只读也行），把核心阅读链路跑通。
4) 最后补运营向：carousels/settings/imports（不影响核心业务的可以后置）。

---

## 9. 本次 subagent fail 的原因（说明）

此前 codex subagent 在生成报告过程中触发了 429 usage limit（额度/频控），所以未能自动写出报告；本文件改为人工审计生成。
