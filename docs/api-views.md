# API Views（V4.2）

更新时间：2026-03-04
范围：`apps/web`、`apps/admin`、`apps/api`

## 1. 前端页面 -> API 映射（核心链路）

### 1.1 用户端（`apps/web/app/app/[tenantSlug]/*`）

| 路由 | 页面文件 | 页面职责 | 主要 API |
|---|---|---|---|
| `/app/[tenantSlug]` | `apps/web/app/app/[tenantSlug]/page.tsx` | 看板概览 | `GET /me`、`GET /products`、`GET /series`、`GET /featured-products` |
| `/app/[tenantSlug]/products` | `apps/web/app/app/[tenantSlug]/products/page.tsx` | 产品列表 + 新建/编辑抽屉 + 移动筛选 | `GET /products`、`GET /series`、`POST /products`、`PUT /products/:id`、图片相关接口 |
| `/app/[tenantSlug]/products/[productId]` | `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx` | 旧管理页入口（已退役） | 无（仅重定向回列表） |
| `/app/[tenantSlug]/breeders` | `apps/web/app/app/[tenantSlug]/breeders/page.tsx` | 种龟视图 | `GET /products`、`GET /series` |
| `/app/[tenantSlug]/breeders/[id]` | `apps/web/app/app/[tenantSlug]/breeders/[id]/page.tsx` | 种龟详情 | `GET /products/:id`、`GET /products/:id/events`、`GET /products/:id/images` |
| `/app/[tenantSlug]/series` | `apps/web/app/app/[tenantSlug]/series/page.tsx` | 系列管理 | `GET /series`、`POST /series`、`PUT /series/:id` |
| `/app/[tenantSlug]/share-presentation` | `apps/web/app/app/[tenantSlug]/share-presentation/page.tsx` | 分享页视觉配置 | `GET /tenant-share-presentation`、`PUT /tenant-share-presentation` |

### 1.2 公开分享端（`apps/web/app/public/s/[shareToken]/*`）

| 路由 | 页面职责 | 主要 API |
|---|---|---|
| `/public/s/[shareToken]` | 公开宠物流 | `GET /s/:shareToken`、`GET /shares/:shareId/public` |
| `/public/s/[shareToken]/series` | 公开系列流 | `GET /shares/:shareId/public` |
| `/public/s/[shareToken]/products/[id]` | 公开详情流 | `GET /shares/:shareId/public` |
| `/public/s/[shareToken]/me` | 转化与回流入口 | `GET /shares/:shareId/public` |

### 1.3 平台管理端（`apps/admin/app/dashboard/*`）

| 路由 | 页面职责 | 主要 API |
|---|---|---|
| `/dashboard` | 平台总览 | `GET /admin/tenants`、`GET /admin/audit-logs` |
| `/dashboard/tenants` | 用户管理 | `GET /admin/tenants` |
| `/dashboard/tenants/[tenantId]` | 用户详情/订阅 | `GET /admin/tenants/:tenantId`、`PUT /admin/tenants/:tenantId/subscription` |
| `/dashboard/memberships` | 成员治理 | `GET /admin/tenants/:tenantId/members`、`POST /admin/tenants/:tenantId/members` |
| `/dashboard/analytics` | 活跃度分析 | `GET /admin/analytics/activity/overview` |
| `/dashboard/usage` | 用量分析 | `GET /admin/analytics/usage/overview` |
| `/dashboard/billing` | 付费分析 | `GET /admin/analytics/revenue/overview` |

## 2. 产品抽屉化后的 API 行为

## 2.1 创建抽屉（`mode=create`）

来源：`apps/web/components/product-drawer/create.tsx`

1. 读取系列输入并匹配或创建系列
2. 提交产品主体：`POST /products`
3. 若用户已选图片：调用图片上传与排序/主图逻辑

关键点：图片上传与资料提交在同一抽屉流程，不再跳转独立页面。

## 2.2 编辑抽屉（`mode=edit`）

来源：`apps/web/components/product-drawer/edit.tsx`

1. 加载产品详情与图片列表
2. 提交资料：`PUT /products/:id`
3. 图片操作：
   - 查询：`GET /products/:id/images`
   - 上传：`POST /products/:id/images`
   - 设主图：`PUT /products/:pid/images/:iid/main`
   - 排序：`PUT /products/:pid/images/reorder`
   - 删除：`DELETE /products/:pid/images/:iid`

## 3. 分享创建与打开策略

来源：`apps/web/components/tenant-floating-share-button.tsx`

1. 创建分享：`POST /shares`
2. 成功后复制链接（失败则降级提示）
3. 尝试打开新页：
   - 优先 `window.open`
   - 失败时降级 `<a target="_blank">` 点击

结论：不再把“打开失败”作为默认错误提示，降低误报。

## 4. API 口径（避免歧义）

- `products` 是主实体；`breeders` 是前端视图语义。
- 公开分享端默认只读，不发起写请求。
- 旧产品详情管理路由已退场，新增功能必须回到 `/products` 抽屉主流程。

## 5. 变更影响范围

本轮 API 文档口径变更主要来自以下文件：

- `apps/web/app/app/[tenantSlug]/products/page.tsx`
- `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx`
- `apps/web/components/product-drawer.tsx`
- `apps/web/components/product-drawer/create.tsx`
- `apps/web/components/product-drawer/edit.tsx`
- `apps/web/components/tenant-floating-share-button.tsx`
