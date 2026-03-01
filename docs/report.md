# coding-docs 总报告（输出契约）

更新时间：2026-03-01

说明：本文保留了整理当时的过程记录；`docs` 目录现已收敛，部分历史路径已删除。

## 1) 结论摘要

仓库当前是“双轨并行”架构：`frontend/ + backend/` 的 Legacy 业务仍可运行，同时 `apps/web + apps/admin + apps/api` 的多租户 SaaS 主线已经成型。基于结构扫描结果，`docs/` 缺少 coding-docs 定义的核心最小集文档（已在本次补齐到 `docs/` 根目录）。

置信度：高（结构与路由来自脚本与代码双证据）。

## 2) 用户故事链路

### JNY-001 租户用户登录并进入租户工作台（SaaS）

- 角色：租户用户
- 触发场景：首次登录或 token 失效后重新进入系统
- 成功标准：获得 `accessToken`，完成 tenant 上下文切换，进入 `/app/[tenantSlug]`

Happy Path:

1. 用户访问 `/login`
- 前端路由：`apps/web/app/login/page.tsx:301`
- 调用：`POST /auth/password-login` 或 `POST /auth/request-code` + `POST /auth/verify-code`
- 后端：`apps/api/src/auth/auth.controller.ts:40`, `apps/api/src/auth/auth.controller.ts:24`, `apps/api/src/auth/auth.controller.ts:32`
- 状态变化：`未登录 -> 已登录(accessToken)`

2. 用户进入 `/tenant-select` 并选择租户
- 前端路由：`apps/web/app/tenant-select/page.tsx:28`, `apps/web/app/tenant-select/page.tsx:87`
- 调用：`GET /tenants/me`, `POST /auth/switch-tenant`
- 后端：`apps/api/src/tenants/tenants.controller.ts:32`, `apps/api/src/auth/auth.controller.ts:48`
- 状态变化：`token(无tenant) -> token(tenant上下文)`

3. 用户进入 `/app/[tenantSlug]`
- 前端路由：`apps/web/app/tenant-select/page.tsx:88`
- 调用：`GET /me` 验证当前会话
- 后端：`apps/api/src/auth/me.controller.ts:10`
- 状态变化：`tenant已选定，可访问 tenant 业务 API`

Exception Paths:

- E1: token 过期/无效
- 现象：请求返回 401，前端清理 token 并跳回登录
- 证据：`apps/web/lib/api-client.ts:137`, `apps/web/lib/api-client.ts:139`

- E2: 登录后无 tenant
- 现象：业务接口返回 `TenantNotSelected`
- 证据：`apps/api/src/products/products.controller.ts:181`, `apps/api/src/series/series.controller.ts:40`

### JNY-002 租户管理员创建产品并生成公开分享（SaaS）

- 角色：租户 OWNER/ADMIN/EDITOR
- 触发场景：管理产品并对外分享
- 成功标准：产品创建成功，分享链接生成并可访问

Happy Path:

1. 进入产品页 `/app/[tenantSlug]/products`
- 前端路由：`apps/web/app/app/[tenantSlug]/products/page.tsx:260`
- 调用：`GET /products`
- 后端：`apps/api/src/products/products.controller.ts:71`

2. 创建产品
- 前端调用：`apps/web/app/app/[tenantSlug]/products/page.tsx:443`
- API：`POST /products`
- 后端：`apps/api/src/products/products.controller.ts:60`
- 状态变化：新增产品实体（tenant 作用域）

3. 生成分享
- 前端调用：`apps/web/app/app/[tenantSlug]/products/page.tsx:477`
- API：`POST /shares`
- 后端：`apps/api/src/shares/shares.controller.ts:42`
- 状态变化：新增分享实体，返回 `entryUrl`

4. 公开访问分享内容
- 前端/服务：`apps/web/app/public/_shared/public-share-api.ts:125`
- API：`GET /shares/:shareId/public`
- 后端：`apps/api/src/shares/shares.controller.ts:69`
- 状态变化：公开读取，不写业务数据

Exception Paths:

- E1: 权限不足（非 EDITOR）
- 现象：创建/编辑操作失败
- 证据：`apps/api/src/products/products.controller.ts:61`, `apps/api/src/shares/shares.controller.ts:44`

- E2: 订阅未就绪
- 现象：受订阅守卫限制
- 证据：`apps/api/src/products/products.controller.ts:55`, `apps/api/src/shares/shares.controller.ts:43`

### JNY-003 查看 product 详情、事件和家族树（SaaS，路由名 breeders）

- 角色：租户查看者（VIEWER+）
- 触发场景：从 product 列表进入个体详情
- 成功标准：详情、事件、家族树三块数据都可展示

Happy Path:

1. 进入 `/app/[tenantSlug]/breeders/[id]`
- 前端路由：`apps/web/app/app/[tenantSlug]/breeders/[id]/page.tsx:61`
- 调用：`GET /breeders/:id`, `GET /breeders/:id/events`, `GET /breeders/:id/family-tree`
- 后端：`apps/api/src/breeders/breeders.controller.ts:45`, `apps/api/src/breeders/breeders.controller.ts:54`, `apps/api/src/breeders/breeders.controller.ts:63`
- 状态变化：只读查询

Exception Paths:

- E1: 无 tenant 上下文
- 证据：`apps/api/src/breeders/breeders.controller.ts:80`

### JNY-004 平台超管管理租户/会员/审计（Admin）

- 角色：平台超级管理员
- 触发场景：平台级运营管理
- 成功标准：完成租户与会员操作，并可在审计中追踪

Happy Path:

1. 登录 `/login`（admin app）
- 前端：`apps/admin/app/login/page.tsx:96`, `apps/admin/app/login/page.tsx:118`, `apps/admin/app/login/page.tsx:150`
- BFF：`apps/admin/app/api/auth/password-login/route.ts:27`, `apps/admin/app/api/auth/request-code/route.ts:20`, `apps/admin/app/api/auth/verify-code/route.ts:16`
- 上游 API：`/auth/*`

2. 进入 `/dashboard` 拉取平台数据
- 前端：`apps/admin/app/dashboard/page.tsx:35`, `apps/admin/app/dashboard/page.tsx:38`
- API：`GET /admin/tenants`, `GET /admin/audit-logs`
- 后端：`apps/api/src/admin/admin.controller.ts:38`, `apps/api/src/admin/admin.controller.ts:140`

3. 管理租户成员和订阅
- 前端：`apps/admin/app/dashboard/memberships/page.tsx:140`, `apps/admin/app/dashboard/memberships/page.tsx:188`, `apps/admin/app/dashboard/memberships/page.tsx:245`
- API：`GET/POST/DELETE /admin/tenants/:tenantId/members`
- 后端：`apps/api/src/admin/admin.controller.ts:105`, `apps/api/src/admin/admin.controller.ts:117`, `apps/api/src/admin/admin.controller.ts:129`

Exception Paths:

- E1: 不在 super-admin 白名单
- 证据：`apps/admin/app/api/auth/password-login/route.ts:16`, `apps/admin/app/api/auth/session/route.ts:19`

### JNY-L01 Legacy 管理员维护 product 与事件（Legacy）

- 角色：Legacy admin
- 触发场景：在旧后台维护 product、事件和配置
- 成功标准：数据在 FastAPI + SQLite 生效

Happy Path:

1. 登录 `/admin`
- 前端路由：`frontend/src/App.tsx:44`
- API：`POST /api/auth/login`
- 后端：`backend/app/main.py:178`, `backend/app/api/routers/auth.py:9`

2. 维护 product（Legacy UI 路由仍命名为 breeders）
- 前端服务：`frontend/src/services/productService.ts:25`
- API：`GET/POST/PUT/DELETE /api/products`
- 后端：`backend/app/main.py:179`, `backend/app/main.py:180`, `backend/app/api/routers/products.py:55`, `backend/app/api/routers/admin.py:29`

3. 维护 product 事件（接口名 breeder-events）
- 前端服务：`frontend/src/services/turtleAlbumService.ts:18`, `frontend/src/pages/admin/products/forms/BreederEventsCard.tsx:151`
- API：`POST /api/admin/breeder-events`
- 后端：`backend/app/main.py:193`, `backend/app/api/routers/admin_records.py:224`

## 3) 业务范围

### in-scope

- SaaS 主线（多租户）：登录、租户切换、product、精选 product、公开分享、平台超管后台
- Legacy 主线（单租户）：product、系列、轮播、推荐、设置、product 事件

证据：`apps/api/src/app.module.ts:17`, `backend/app/main.py:177`。

### out-of-scope

- 文档中提及但当前流程未完全落地的注册接口（`/auth/register`）
- 仅 webhook/readiness 的支付模块细节（缺少前端业务闭环）
- 归档文档和迁移历史的“实施细节复原”

证据：`apps/web/app/login/page.tsx:139`, `apps/api/src/payments/payments.controller.ts:13`, `docs/README.md:56`。

### 核心对象与主键口径

- SaaS 主键：`tenantId`、`tenant.slug`、`user.id`、`product.id`、`shareToken/shareId`
- Legacy 主键：`products.id`、`series.id`、`code`（业务展示键）

证据：`apps/api/src/tenants/tenants.controller.ts:16`, `apps/api/src/shares/shares.controller.ts:55`, `backend/app/models/models.py:52`, `backend/app/models/models.py:17`。

## 4) 接口与代码锚点

| 业务能力 | API | 实现锚点 |
|---|---|---|
| SaaS 登录与验证码 | `POST /auth/request-code` `POST /auth/verify-code` `POST /auth/password-login` | `apps/api/src/auth/auth.controller.ts:24` `apps/api/src/auth/auth.controller.ts:32` `apps/api/src/auth/auth.controller.ts:40` |
| SaaS 切换租户 | `POST /auth/switch-tenant` | `apps/api/src/auth/auth.controller.ts:48` |
| SaaS 获取当前用户 | `GET /me` | `apps/api/src/auth/me.controller.ts:10` |
| SaaS 租户管理（用户侧） | `GET /tenants/me` `GET /tenants/current` `POST /tenants` | `apps/api/src/tenants/tenants.controller.ts:32` `apps/api/src/tenants/tenants.controller.ts:39` `apps/api/src/tenants/tenants.controller.ts:21` |
| SaaS 产品管理 | `GET /products` `POST /products` | `apps/api/src/products/products.controller.ts:71` `apps/api/src/products/products.controller.ts:60` |
| SaaS 产品图片管理 | `GET/POST/DELETE/PUT /products/:id/images...` | `apps/api/src/products/products.controller.ts:80` `apps/api/src/products/products.controller.ts:88` `apps/api/src/products/products.controller.ts:138` `apps/api/src/products/products.controller.ts:152` |
| SaaS product/系列读取（路由名 breeders） | `GET /series` `GET /breeders` `GET /breeders/:id/events` | `apps/api/src/series/series.controller.ts:23` `apps/api/src/breeders/breeders.controller.ts:27` `apps/api/src/breeders/breeders.controller.ts:54` |
| SaaS 公开分享 | `POST /shares` `GET /s/:shareToken` `GET /shares/:shareId/public` | `apps/api/src/shares/shares.controller.ts:42` `apps/api/src/shares/shares.controller.ts:55` `apps/api/src/shares/shares.controller.ts:69` |
| SaaS 平台后台 | `/admin/*` | `apps/api/src/admin/admin.controller.ts:32` |
| Legacy 认证 | `POST /api/auth/login` `GET /api/auth/verify` | `backend/app/main.py:178` `backend/app/api/routers/auth.py:9` `backend/app/api/routers/auth.py:42` |
| Legacy product 与系列（路由名 breeders） | `GET /api/series` `GET /api/breeders` | `backend/app/main.py:187` `backend/app/main.py:188` `backend/app/api/routers/series.py:11` `backend/app/api/routers/breeders.py:17` |
| Legacy product 事件写入 | `POST /api/admin/breeder-events` `POST /api/admin/mating-records` `POST /api/admin/egg-records` | `backend/app/main.py:193` `backend/app/api/routers/admin_records.py:224` `backend/app/api/routers/admin_records.py:106` `backend/app/api/routers/admin_records.py:167` |
| Legacy 设置 | `GET/PUT /api/settings` | `backend/app/main.py:183` `backend/app/api/routers/settings.py:16` `backend/app/api/routers/settings.py:43` |

## 5) 前后端路由映射

### 高置信映射（>=0.8）

| 前端路由 | API 调用 | 后端路由 | confidence |
|---|---|---|---|
| `/login` (web) | `POST /auth/password-login` | `AuthController.passwordLogin` | 0.95 |
| `/login` (web) | `POST /auth/request-code` -> `POST /auth/verify-code` | `AuthController.requestCode/verifyCode` | 0.95 |
| `/tenant-select` | `GET /tenants/me` + `POST /auth/switch-tenant` | `TenantsController.getMyTenants` + `AuthController.switchTenant` | 0.95 |
| `/app/[tenantSlug]/products` | `GET /products` + `POST /products` | `ProductsController.listProducts/createProduct` | 0.95 |
| `/app/[tenantSlug]/products` | `POST /shares` | `SharesController.createShare` | 0.9 |
| `/app/[tenantSlug]/products/[productId]` | `POST /products/:id/images` | `ProductsController.uploadImage` | 0.95 |
| `/app/[tenantSlug]/featured-products` | `GET/POST/DELETE/PUT /featured-products*` | `FeaturedProductsController.*` | 0.95 |
| `/app/[tenantSlug]/breeders` | `GET /series` + `GET /breeders` | `SeriesController.listSeries` + `BreedersController.listBreeders` | 0.95 |
| `/app/[tenantSlug]/breeders/[id]` | `GET /breeders/:id` `/events` `/family-tree` | `BreedersController.*` | 0.95 |
| `/public/share` | `GET /shares/:shareId/public` | `SharesController.getPublicShare` | 0.9 |
| `/dashboard/*` (admin app) | `/api/proxy/admin/* -> /admin/*` | `AdminController.*` | 0.9 |
| `/` (legacy) | `GET /api/series` + `GET /api/breeders` | `series.list_series` + `breeders.list_breeders` | 0.9 |

### 待复核（<0.5）

- 自动脚本将 demo 资源路径 `/images/mg_02.jpg`、`/images/mg_03.jpg` 误推到上传接口，属于“样例资源命中”，需人工忽略。
- 证据：`out/coding-docs/map_routes.md`（`api_to_backend_mappings` 中 confidence 0.4 条目）。

## 6) 冲突（已识别）

### 冲突 1：术语分叉（已决策统一为 `product`）

- 现象：代码仍存在 `breeders` 路由与 `Product` 模型并行命名。
- 证据：`backend/app/models/models.py:37`, `backend/app/api/routers/breeders.py:24`, `apps/api/src/breeders/breeders.controller.ts:21`
- 风险：跨模块沟通或新需求扩展时，路由名与业务语义不一致造成误读。

### 冲突 2：鉴权能力补齐（Legacy refresh 已实现）

- 现象：Legacy refresh 路由已补齐，返回结构与 login 对齐（`token/user/expiresAt`）。
- 证据：`frontend/src/services/authService.ts:8`, `frontend/src/services/authService.ts:82`, `backend/app/api/routers/auth.py:24`
- 风险：refresh 当前尚未接入自动续期拦截器，调用链还需在后续前端迭代中启用。
- 决策：能力保留并继续增强（后续可接入 axios 401 自动刷新策略）。

### 冲突 3：文档入口差异（已修复）

- 现象：此前根 README 使用过旧路径，和 `docs/README.md` 索引不一致。
- 修复：根 README 已改为统一指向 `docs/README.md`，并补齐 legacy/归档路径。
- 证据：`README.md:23`, `README.md:26`, `README.md:29`

### 冲突 4：运行期与参考代码混放（Legacy 与 SaaS 并存）

- 现象：Legacy 代码与 SaaS 代码在仓库根层并列，存在“运行代码/参考代码”边界不清的问题。
- 证据：`README.md:8`, `README.md:9`, `README.md:10`, `docs/README.md:25`
- 风险：新成员容易误把 Legacy 当作当前主线改动目标。
- 决策：Legacy 保留用于参考，采用“先建参考入口、后做目录收纳迁移”的策略（见 `legacy/README.md`）。

## 7) 文档组织建议

### 保留/新增/合并建议

- `keep`：保留 `docs/README.md` 作为现有入口
- `add`：新增 `docs/runtime-guide.md`
- `add`：新增 `docs/user-journeys.md`
- `add`：新增 `docs/business-flows.md`
- `add`：新增 `docs/api-views.md`
- `add`：新增 `docs/task-detail-views.md`
- `add`：新增 `docs/technical-reference.md`
- `merge_candidate`：`docs/README.md` 与 `docs/ARCHITECTURE.md` 的“架构定位”区块可合并去重

### 必需模块缺口（本次已补齐到 `docs/` 根目录）

- runtime-guide
- user-journeys
- business-flows
- api-views
- task-detail

## 8) 剪枝候选

### 脚本结果

- `out/coding-docs/doc_prune_report.md`：`total_docs=4`（根层文档），`candidates=0`，默认全部 `keep`

### 人工补充候选（不自动执行）

- `merge_candidate`：`docs/README.md` + `docs/ARCHITECTURE.md`
- 理由：结构扫描给出 `max_similarity=0.4106`，且两者都维护“架构定位 + Legacy 参考”
- 影响：仅影响文档维护成本，不影响运行时
- 约束：默认不自动删除

### spec 专项剪枝（`docs/spec`）

- 范围：`docs/spec/*.md`
- 执行结果：保留 `10`，已删除 `6`
- 报告：`out/coding-docs/spec_prune_report.md`
- 索引与治理入口：`docs/spec/README.md`

专项结论：

- `docs/spec` 当前仅保留“生效规格 + 短期落地规格”。
- 迁移/审计/任务建议与测试数据重叠文档已按确认直接清理。
