# API Spec（接口详细口径与设计原因，Legacy -> Node 重构对齐用）

更新日期：2026-02-26

说明：本文是对 `docs/API_OVERVIEW.md` 中每个接口的详细口径补充，目标是：
- 重构到 Node.js 时能做到“行为一致/可验收”；
- 对关键设计点（幂等/安全/为什么这样分层）给出理由。

> 当前代码实现来源：`backend/app/main.py` + `backend/app/api/routers/*.py`。

---

## 约定

- 响应外层：多数接口返回 `ApiResponse`（见 `backend/app/schemas/schemas.py`）。
- 鉴权：Legacy 为 `Authorization: Bearer <token>`（由 `/api/auth/login` 获取）。
- 错误：404 表示资源不存在；401/403 表示未登录/无权限（具体以实现为准）。

---

## 1) Auth

### POST /api/auth/login

- 用途：后台登录，获取 JWT。
- Request：`{ username, password }`
- Response：`{ token, user, expiresAt }`
- 设计原因：最小可用后台鉴权。
- 迁移到 Node：后续会被 SaaS 的 email 登录 + tenant-scoped token 替代（见 `docs/SAAS_REQUIREMENTS.md`）。
- Source：`backend/app/api/routers/auth.py`

### POST /api/auth/logout

- 用途：登出（当前实现通常是前端清 token；后端返回成功）。
- 设计原因：给 UI 一个明确动作；若未来引入 token blacklist/refresh token，可在此扩展。
- Source：`backend/app/api/routers/auth.py`

### GET /api/auth/verify

- 用途：校验 token 是否有效，返回当前用户。
- 设计原因：前端启动时快速自检。
- Source：`backend/app/api/routers/auth.py`

---

## 2) Products（公共）

### GET /api/products

- 用途：产品列表（分页/筛选/排序）。
- Query：
  - `page`（默认 1）
  - `limit`（默认 50）
  - `search`（按 code/description 模糊匹配）
  - `sort`（newest/popular/price_low/price_high）
  - `sex`、`series_id`、`price_min`、`price_max`
- Response：`{ products, total, page, totalPages }`
- 设计原因：公共页列表需要一次性返回分页信息，避免前端猜测。
- Source：`backend/app/api/routers/products.py`

### GET /api/products/{product_id}

- 用途：产品详情。
- 设计原因：详情页稳定入口。
- Source：`backend/app/api/routers/products.py`

### GET /api/products/featured

- 用途：精选产品；若无 featured，则 fallback newest。
- 设计原因：运营置顶为空时不至于页面空白。
- Source：`backend/app/api/routers/products.py`

### GET /api/products/filter-options

- 用途：返回过滤项（当前主要为价格范围）。
- 设计原因：避免前端写死价格范围。
- Source：`backend/app/api/routers/products.py`

---

## 3) Products（后台管理）

> 以下接口 prefix 仍为 `/api/products`，但需要登录。

### POST /api/products

- 用途：创建产品。
- 设计原因：后台录入。
- 迁移注意：SaaS 后必须 tenant_id 隔离 + RBAC。
- Source：`backend/app/api/routers/admin.py`

### PUT /api/products/{product_id}

- 用途：更新产品。
- 关键约束：Removed fields 不允许（见 `backend/app/core/request_validation.py` 与 main.py 的 400 处理）。
- 设计原因：防止前端/旧客户端提交已废弃字段导致数据污染。
- Source：`backend/app/api/routers/admin.py`

### DELETE /api/products/{product_id}

- 用途：删除产品。
- Source：`backend/app/api/routers/admin.py`

### POST /api/products/{product_id}/images

- 用途：追加上传图片（语义：追加，不是覆盖 images 全量数组）。
- 设计原因：避免 PUT 全量覆盖导致误删历史图片。
- Source：`backend/app/api/routers/admin.py`

### DELETE /api/products/{product_id}/images/{image_id}

- 用途：删除单张图片。
- Source：`backend/app/api/routers/admin.py`

### PUT /api/products/{product_id}/images/{image_id}/set-main

- 用途：设为主图。
- 设计原因：主图=第一张图，影响详情页/列表卡片。
- Source：`backend/app/api/routers/admin.py`

### PUT /api/products/{product_id}/images/reorder

- 用途：图片重排。
- 设计原因：移动端不方便拖拽，重排必须有稳定接口。
- Source：`backend/app/api/routers/admin.py`

---

## 4) Imports（批量导入）

### GET /api/products/batch-import/template

- 用途：下载 Excel 模板。
- Source：`backend/app/api/routers/imports.py`

### POST /api/products/batch-import

- 用途：批量导入（Excel + ZIP）。
- 设计原因：降低运营成本。
- Source：`backend/app/api/routers/imports.py`

---

## 5) Series

### GET /api/series

- 用途：系列列表（公共）。
- Source：`backend/app/api/routers/series.py`

---

## 6) Breeders（公共聚合视图）

### GET /api/breeders

- 用途：种龟列表（按 series/sex/status 等聚合返回）。
- 设计原因：前端瀑布流/筛选避免 N+1。
- Source：`backend/app/api/routers/breeders.py`

### GET /api/breeders/by-code/{code}

- 用途：按编号定位个体。
- 设计原因：外部输入编号跳转/校验常用。
- Source：`backend/app/api/routers/breeders.py`

### GET /api/breeders/{breeder_id}

- 用途：种龟详情（聚合信息）。
- Source：`backend/app/api/routers/breeders.py`

### GET /api/breeders/{breeder_id}/records

- 用途：旧记录接口（交配/产蛋记录）。
- 迁移说明：后续以 `breeder_events` 为权威来源。
- Source：`backend/app/api/routers/breeders.py`

### GET /api/breeders/{breeder_id}/events

- 用途：事件时间线（交配/产蛋/换公等结构化事件）。
- 设计原因：从 description 的“自由文本记录”迁移到结构化表，便于计算状态与审计。
- Source：`backend/app/api/routers/breeders.py`

### GET /api/breeders/{breeder_id}/mate-load

- 用途：配偶负载（种公->关联母龟列表 + 待交配/逾期统计等）。
- Source：`backend/app/api/routers/breeders.py`

### GET /api/breeders/{breeder_id}/family-tree

- 用途：族谱。
- 设计原因：按 code/sire_code/dam_code 反推。
- Source：`backend/app/api/routers/breeders.py`

---

## 7) Admin Series

- 接口：GET/POST/PUT/DELETE `/api/admin/series`
- Source：`backend/app/api/routers/admin_series.py`

---

## 8) Admin Records / Events

- `POST /api/admin/mating-records`
- `DELETE /api/admin/mating-records/{record_id}`
- `POST /api/admin/egg-records`
- `DELETE /api/admin/egg-records/{record_id}`
- `POST /api/admin/breeder-events`

设计原因：把记录写入收敛在 admin 端，公共端只读。

Source：`backend/app/api/routers/admin_records.py`

---

## 9) Carousels / Featured / Settings

- Carousels：`backend/app/api/routers/carousels.py`
- Featured：`backend/app/api/routers/featured.py`
- Settings：`backend/app/api/routers/settings.py`

说明：这些为“站点展示/运营”类能力，SaaS 化后需要 tenant 隔离与权限拆分。

---

## 10) Images

### GET /api/images/{filename}

- 用途：图片读取（legacy 路径）。
- 迁移到 Node：统一走对象存储 + signed URL；此接口可能废弃。
- Source：`backend/app/api/routers/images.py`
