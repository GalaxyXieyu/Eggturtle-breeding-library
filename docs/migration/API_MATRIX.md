# MIGRATION_API_MATRIX（Legacy FastAPI -> Node Nest API 接口对照）

更新日期：2026-02-28

目的：把 legacy FastAPI（`backend/`）的接口按“模块/路径”梳理出来，并对照 Node Nest API（`apps/api`）目前是否已有等价接口，便于排期与决定何时可以停掉 legacy。

注意：

- Legacy API 统一前缀：`/api/...`
- Node API 目前无全局 `/api` 前缀，base URL 形态为：`/<module>...`（例如 `/products`、`/auth/request-code`）
- Legacy 与 Node 的认证方式不同（账号密码 vs 邮箱验证码 + tenant-scoped token），即便“同名模块”也不能简单替换。

---

## 1. Auth（认证）

### Legacy（FastAPI）
前缀：`/api/auth`

- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET  `/api/auth/verify`

### Node（Nest）

- POST `/auth/request-code`
- POST `/auth/verify-code`
- POST `/auth/switch-tenant`
- GET  `/me`

覆盖判断：部分覆盖（功能不同）

- Legacy 是“管理员账号密码登录”思路；Node 是“邮箱验证码 + 多租户切换 + /me”思路。
- 迁移需要明确：最终要保留哪种 auth（或做兼容层/双轨）。

---

## 2. Tenants（多租户）

### Legacy（FastAPI）
- 无显式 tenants 模块。

### Node（Nest）

- POST `/tenants`（创建 tenant）
- GET  `/tenants/me`（我加入的 tenants）
- GET  `/tenants/current`（当前 token 的 tenant）
- POST `/auth/switch-tenant`（切换 tenant，返回新 access token）

覆盖判断：Node 新增能力（legacy 无对应）

---

## 3. Products（产品）

### Legacy（FastAPI，公开/读取）
前缀：`/api/products`

- GET `/api/products/featured`
- GET `/api/products/filter-options`
- GET `/api/products`
- GET `/api/products/{product_id}`

### Legacy（FastAPI，管理/写入/图片管理）
同样挂在前缀：`/api/products`

- POST   `/api/products`
- PUT    `/api/products/{product_id}`
- DELETE `/api/products/{product_id}`
- POST   `/api/products/{product_id}/images`
- DELETE `/api/products/{product_id}/images/{image_id}`
- PUT    `/api/products/{product_id}/images/{image_id}/set-main`
- PUT    `/api/products/{product_id}/images/reorder`

### Node（Nest）

- GET  `/products`
- POST `/products`
- POST   `/products/:id/images`
- GET    `/products/:pid/images/:iid/content`
- DELETE `/products/:pid/images/:iid`
- PUT    `/products/:pid/images/:iid/main`
- PUT    `/products/:pid/images/reorder`

并且还有 public featured：
- GET `/products/featured`

覆盖判断：API 基本覆盖（但语义/路径不完全一致）

主要差异：
- legacy 有 `/filter-options`，Node 暂未见等价 endpoint。
- legacy 图片读取走 `/api/images/{filename}`；Node 走 imageId + `.../content`。

---

## 4. Imports / Batch Import（批量导入）

### Legacy（FastAPI）
前缀：`/api/products/batch-import`

- GET  `/api/products/batch-import/template`
- POST `/api/products/batch-import`

### Node（Nest）
- 暂无。

覆盖判断：缺失

---

## 5. Series（系列/品系）

### Legacy（FastAPI）

- GET `/api/series`

管理端：
- GET    `/api/admin/series`
- POST   `/api/admin/series`
- PUT    `/api/admin/series/{series_id}`
- DELETE `/api/admin/series/{series_id}`

### Node（Nest）
- 暂无。

覆盖判断：缺失

---

## 6. Breeders（种龟：核心）

### Legacy（FastAPI）
前缀：`/api/breeders`

- GET `/api/breeders`（列表）
- GET `/api/breeders/by-code/{code}`
- GET `/api/breeders/{breeder_id}`
- GET `/api/breeders/{breeder_id}/records`
- GET `/api/breeders/{breeder_id}/events`
- GET `/api/breeders/{breeder_id}/mate-load`
- GET `/api/breeders/{breeder_id}/family-tree`

### Node（Nest）
- 暂无。

覆盖判断：缺失（核心阻塞项）

---

## 7. Admin Records（交配/产蛋/事件写入）

### Legacy（FastAPI）
前缀：`/api/admin`

- POST   `/api/admin/mating-records`
- DELETE `/api/admin/mating-records/{record_id}`
- POST   `/api/admin/egg-records`
- DELETE `/api/admin/egg-records/{record_id}`
- POST   `/api/admin/breeder-events`

### Node（Nest）
- 暂无。

覆盖判断：缺失

备注：这块与 SaaS 需求中“结构化 breeder_events 表（交配/产蛋/换公）”直接对应。

---

## 8. Featured Products（精选产品）

### Legacy（FastAPI）
前缀：`/api/featured-products`

- GET    `/api/featured-products`
- POST   `/api/featured-products`
- PUT    `/api/featured-products/{featured_id}`
- DELETE `/api/featured-products/{featured_id}`

### Node（Nest）

- GET    `/featured-products`
- POST   `/featured-products`
- DELETE `/featured-products/:id`
- PUT    `/featured-products/reorder`

覆盖判断：基本覆盖（但 legacy 有 PUT 单条更新；Node 用 reorder）

---

## 9. Carousels（轮播）

### Legacy（FastAPI）
前缀：`/api/carousels`

- GET    `/api/carousels`
- POST   `/api/carousels`
- PUT    `/api/carousels/{carousel_id}`
- DELETE `/api/carousels/{carousel_id}`

### Node（Nest）
- 暂无。

覆盖判断：缺失

---

## 10. Settings（设置）

### Legacy（FastAPI）
前缀：`/api/settings`

- GET `/api/settings`
- PUT `/api/settings`

### Node（Nest）
- 暂无。

覆盖判断：缺失

---

## 11. Images（图片读取）

### Legacy（FastAPI）
前缀：`/api`

- GET `/api/images/{filename}`

### Node（Nest）
- GET `/products/:pid/images/:iid/content`（产品图读取）
- 另：若启用静态资源：`UPLOAD_PUBLIC_ENABLED=true` 时可通过 `/uploads/...` 访问（与配置有关）

覆盖判断：部分覆盖（实现路径完全不同）

---

## 12. Shares（分享页/公开访问）

### Legacy（FastAPI）
- 未见同等模块。

### Node（Nest）

- POST `/shares`
- GET  `/s/:shareToken`
- GET  `/shares/:shareId/public`

覆盖判断：Node 新增能力

---

## 13. Admin / Audit Logs（平台后台）

### Legacy（FastAPI）
- 未见同等“平台级 tenants/users/audit”模块（legacy 更像单租户运营后台）。

### Node（Nest）

- GET  `/audit-logs`
- GET  `/admin/audit-logs`
- GET  `/admin/tenants`
- GET  `/admin/tenants/:tenantId`
- POST `/admin/tenants`
- GET  `/admin/users`
- GET  `/admin/tenants/:tenantId/members`
- POST `/admin/tenants/:tenantId/members`

覆盖判断：Node 新增能力

---

## 什么时候能停 legacy（API 视角）

至少需要 Node API 补齐：

- `series`（含管理端 CRUD）
- `breeders`（列表/详情/by-code/records/events/mate-load/family-tree）
- `admin records`（mating/egg/breeder-events 写入与删除）
- `settings`、`carousels`
- `imports`（batch-import + template）

以及：确认 auth 模式最终口径（否则前后端都不好切换）。
