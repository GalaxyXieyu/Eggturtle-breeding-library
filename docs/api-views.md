# API Views（主线 + Legacy 映射）

更新时间：2026-03-01  
范围：`apps/web`、`apps/admin`、`apps/api`、`legacy/backend`

## 1. 前端页面 -> API 映射

### 1.1 Web 页面路由（`apps/web/app`）

| 路由 | 页面文件 | 页面功能 | 主要调用 API |
|---|---|---|---|
| `/` | `apps/web/app/page.tsx` | 官网落地页 | 无 |
| `/login` | `apps/web/app/login/page.tsx` | 登录/注册/激活码兑换 | `POST /auth/request-code`、`POST /auth/register`、`POST /auth/password-login`、`POST /auth/verify-code`、`POST /subscriptions/activation-codes/redeem` |
| `/app` | `apps/web/app/app/page.tsx` | 自动进入租户工作台 | `POST /auth/switch-tenant`、`GET /tenants/current`、`GET /tenants/me` |
| `/tenant-select` | `apps/web/app/tenant-select/page.tsx` | 选择/创建租户 | `GET /tenants/me`、`POST /tenants`、`POST /auth/switch-tenant` |
| `/app/[tenantSlug]` | `apps/web/app/app/[tenantSlug]/page.tsx` | 工作台概览（含 AI 次数） | `GET /me`、`GET /me/subscription`、`GET /products`、`GET /series`、`GET /featured-products`、`GET /ai-assistant/quota` |
| `/app/[tenantSlug]/products` | `apps/web/app/app/[tenantSlug]/products/page.tsx` | 种龟/产品列表与创建 | `GET /products`、`POST /products` |
| `/app/[tenantSlug]/products/[productId]` | `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx` | 图片管理 | `GET /products/:id/images`、`POST /products/:id/images`、`PUT /products/:pid/images/:iid/main`、`PUT /products/:pid/images/reorder`、`DELETE /products/:pid/images/:iid` |
| `/app/[tenantSlug]/series` | `apps/web/app/app/[tenantSlug]/series/page.tsx` | 系列管理（读） | `GET /series` |
| `/app/[tenantSlug]/breeders` | `apps/web/app/app/[tenantSlug]/breeders/page.tsx` | 种龟视图（产品别名视图） | `GET /series`、`GET /products` |
| `/app/[tenantSlug]/breeders/[id]` | `apps/web/app/app/[tenantSlug]/breeders/[id]/page.tsx` | 种龟详情（事件/家族树/图片） | `GET /products/:id`、`GET /products/:id/events`、`GET /products/:id/family-tree`、`GET /products/:id/images` |
| `/app/[tenantSlug]/featured-products` | `apps/web/app/app/[tenantSlug]/featured-products/page.tsx` | 活动推荐位 | `GET /featured-products`、`POST /featured-products`、`DELETE /featured-products/:id`、`PUT /featured-products/reorder` |
| `/app/[tenantSlug]/share-presentation` | `apps/web/app/app/[tenantSlug]/share-presentation/page.tsx` | 分享页品牌配置 | `GET /tenant-share-presentation`、`PUT /tenant-share-presentation` |
| `/app/[tenantSlug]/account` | `apps/web/app/app/[tenantSlug]/account/page.tsx` | 账户设置 | `GET /me/profile`、`PUT /me/profile`、`PUT /me/password` |
| `/app/[tenantSlug]/tenants` | `apps/web/app/app/[tenantSlug]/tenants/page.tsx` | 当前账号租户管理 | `GET /tenants/me`、`POST /tenants`、`POST /auth/switch-tenant` |
| `/public/s/[shareToken]` | `apps/web/app/public/s/[shareToken]/page.tsx` | 分享页入口 | `GET /s/:shareToken`、`GET /shares/:shareId/public` |
| `/public/s/[shareToken]/products/[id]` | `apps/web/app/public/s/[shareToken]/products/[id]/page.tsx` | 分享详情 | `GET /shares/:shareId/public`（附 `productId`） |
| `/public/[tenantSlug]` | `apps/web/app/public/[tenantSlug]/page.tsx` | 租户公开页 | `GET /shares/:shareId/public`（签名参数模式） |
| `/public/[tenantSlug]/products/[productId]` | `apps/web/app/public/[tenantSlug]/products/[productId]/page.tsx` | 租户公开详情 | `GET /shares/:shareId/public`（签名参数模式） |

### 1.2 Admin 页面路由（`apps/admin/app`）

| 路由 | 页面文件 | 页面功能 | 主要调用 API |
|---|---|---|---|
| `/login` | `apps/admin/app/login/page.tsx` | 超管登录 | `POST /api/auth/password-login`、`POST /api/auth/request-code`、`POST /api/auth/verify-code` |
| `/dashboard` | `apps/admin/app/dashboard/page.tsx` | 平台概览 | `GET /admin/tenants`、`GET /admin/audit-logs` |
| `/dashboard/tenants` | `apps/admin/app/dashboard/tenants/page.tsx` | 租户列表 | `GET /admin/tenants` |
| `/dashboard/tenants/[tenantId]` | `apps/admin/app/dashboard/tenants/[tenantId]/page.tsx` | 租户详情+订阅配置 | `GET /admin/tenants/:tenantId`、`GET /admin/tenants/:tenantId/subscription`、`PUT /admin/tenants/:tenantId/subscription` |
| `/dashboard/memberships` | `apps/admin/app/dashboard/memberships/page.tsx` | 跨租户成员管理 | `GET /admin/tenants/:tenantId/members`、`POST /admin/tenants/:tenantId/members`、`DELETE /admin/tenants/:tenantId/members/:userId` |
| `/dashboard/audit-logs` | `apps/admin/app/dashboard/audit-logs/page.tsx` | 平台审计日志 | `GET /admin/audit-logs` |

## 2. Node 主线 API 全量视图（`apps/api/src/*.controller.ts`）

### 2.1 Auth / Me / Tenant

- `POST /auth/request-code`
- `POST /auth/verify-code`
- `POST /auth/password-login`
- `POST /auth/switch-tenant`
- `POST /auth/register`
- `GET /me`
- `GET /me/profile`
- `PUT /me/profile`
- `PUT /me/password`
- `GET /me/subscription`
- `POST /tenants`
- `GET /tenants/me`
- `GET /tenants/current`
- `POST /subscriptions/activation-codes/redeem`

### 2.2 Product / Series / Featured

- `POST /products`
- `GET /products`
- `GET /products/by-code/:code`
- `GET /products/public-clicks`
- `POST /products/mating-records`
- `POST /products/egg-records`
- `GET /products/:id`
- `PUT /products/:id`
- `GET /products/:id/public-clicks`
- `GET /products/:id/events`
- `POST /products/:id/events`
- `GET /products/:id/family-tree`
- `GET /products/:id/images`
- `POST /products/:id/images`
- `GET /products/:pid/images/:iid/content`
- `DELETE /products/:pid/images/:iid`
- `PUT /products/:pid/images/:iid/main`
- `PUT /products/:pid/images/reorder`
- `GET /products/featured`（公开精选）
- `GET /series`
- `GET /series/:id`
- `GET /featured-products`
- `POST /featured-products`
- `DELETE /featured-products/:id`
- `PUT /featured-products/reorder`

### 2.3 Share / Public

- `POST /shares`
- `GET /s/:shareToken`
- `GET /shares/:shareId/public`
- `GET /tenant-share-presentation`
- `PUT /tenant-share-presentation`

### 2.4 AI Assistant（预留）

- `GET /ai-assistant/quota`
- `GET /ai-assistant/top-up-packs`
- `POST /ai-assistant/top-up-orders`
- `POST /ai-assistant/auto-record/intents`
- `POST /ai-assistant/query`

### 2.5 Admin / Audit / Health / Payments

- `GET /audit-logs`
- `GET /admin/tenants`
- `GET /admin/tenants/:tenantId`
- `GET /admin/tenants/:tenantId/subscription`
- `PUT /admin/tenants/:tenantId/subscription`
- `POST /admin/subscription-activation-codes`
- `POST /admin/tenants`
- `GET /admin/users`
- `GET /admin/tenants/:tenantId/members`
- `POST /admin/tenants/:tenantId/members`
- `DELETE /admin/tenants/:tenantId/members/:userId`
- `GET /admin/audit-logs`
- `GET /health`
- `GET /health/db`
- `GET /payments/readiness`
- `POST /payments/webhooks/wechat`
- `POST /payments/webhooks/alipay`

## 3. 能力 -> Controller 映射（Node 主线）

| 业务能力 | Controller |
|---|---|
| 认证与会话 | `apps/api/src/auth/auth.controller.ts`、`apps/api/src/auth/me.controller.ts` |
| 租户管理 | `apps/api/src/tenants/tenants.controller.ts` |
| 种龟/产品主链路 | `apps/api/src/products/products.controller.ts` |
| 系列管理（读） | `apps/api/src/series/series.controller.ts` |
| 活动推荐位 | `apps/api/src/featured-products/featured-products.controller.ts` |
| 分享与公开页 | `apps/api/src/shares/shares.controller.ts`、`apps/api/src/tenant-share-presentation/tenant-share-presentation.controller.ts` |
| AI 助手（预留） | `apps/api/src/ai-assistant/ai-assistant.controller.ts` |
| 平台超管 | `apps/api/src/admin/admin.controller.ts` |
| 审计/健康/支付 | `apps/api/src/audit-logs/audit-logs.controller.ts`、`apps/api/src/health.controller.ts`、`apps/api/src/payments/payments.controller.ts` |

## 4. Legacy backend（`legacy/backend`）业务接口口径

以下接口已不作为 Node 主线标准，但其中繁育逻辑仍有参考价值：

- `GET /api/breeders`：包含 `needMatingStatus`（`normal | need_mating | warning`）
- `GET /api/breeders/{id}/family-tree`：祖代/父母/子代/同胞聚合
- `GET /api/breeders/{id}/mate-load`：种公关联母龟负载、待配与预警统计
- `POST /api/admin/mating-records`：新增交配记录（要求同系列、母龟 female、公龟 male）
- `POST /api/admin/egg-records`：新增产蛋记录（仅 female）
- `POST /api/admin/breeder-events`：统一事件写入（支持 `mm.dd`）
- `PUT /api/products/{id}`：更新 `mate_code` 会自动写 `change_mate` 事件

## 5. 当前口径（避免歧义）

- `product` 是主实体；`breeders` 仅作为前端展示语义，不再新增独立后端域。
- 分享已简化：不限制分享链接数量，按订阅写状态与种龟数量控制。
- AI 次数策略：三档都有次数上限，可多次充值叠加；当前“充值/问数/自动记录”仍为占位接口。
