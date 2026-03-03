# Admin Analytics Metrics v0

更新时间：2026-03-03
适用范围：`/admin/analytics/activity/overview`、`/admin/analytics/usage/overview`、`/admin/tenants/:tenantId/usage`、`/admin/analytics/revenue/overview`

## 1. 活跃度（T62）

- DAU：UTC 当天内发生写操作的去重 `actorUserId` 数。
- WAU：最近 7 天（含当天）发生写操作的去重 `actorUserId` 数。
- MAU：最近 30 天（含当天）发生写操作的去重 `actorUserId` 数。
- 活跃租户（7d）：最近 7 天发生写操作的去重 `tenantId` 数。
- 租户留存（7d）：
  - 分母：前 7 天（`today-13` 到 `today-7`）活跃租户。
  - 分子：上述租户中，最近 7 天（`today-6` 到 `today`）仍活跃的租户。
  - 结果：`retained / previousActive`，若分母为 0 则返回 0。

写操作集合（`ACTIVITY_WRITE_ACTIONS`）：
- `product.create`
- `product.update`
- `product.event.create`
- `product.image.upload`
- `product.image.delete`
- `product.image.set_main`
- `product.image.reorder`
- `share.create`
- `subscription.activation.redeem`

## 2. 用量（T63）

### 2.1 指标范围（v0）

- `products`：`products` 表按 `tenantId` 计数。
- `images`：`product_images` 表按 `tenantId` 计数。
- `shares`：`public_shares` 表按 `tenantId` 计数。
- `storageBytes`：`product_images.size_bytes` 按 `tenantId` 求和。

### 2.2 上限与阈值

- `products.limit`：
  - 优先使用 `tenant_subscriptions.max_shares`（沿用当前写入拦截逻辑）。
  - 否则使用套餐默认值：`FREE=10`、`BASIC=30`、`PRO=200`。
- `images.limit`：`tenant_subscriptions.max_images`（`null` 表示 unlimited）。
- `shares.limit`：`tenant_subscriptions.max_shares`（`null` 表示 unlimited）。
- `storageBytes.limit`：`tenant_subscriptions.max_storage_bytes`（`null` 表示 unlimited）。
- `near_limit`：利用率 `>= 80%` 且 `<= 100%`。
- `exceeded`：`used > limit`。

### 2.3 TopN 评分

- `usageScore` = 四个指标中“有上限指标”的最大利用率（百分比）。
- 若当前租户所有指标均 unlimited，则 `usageScore=0`。

## 3. 付费（T64）

### 3.1 收入映射（v0）

- 月价格映射（分）：
  - `FREE=0`
  - `BASIC=39900`
  - `PRO=129900`
- MRR：所有 `ACTIVE` 租户按当前套餐映射求和。
- ARR：`MRR * 12`。

### 3.2 趋势事件

- 数据源：`super_admin_audit_logs`。
- 时间窗：`30d` 或 `90d`，按 UTC 日聚合。
- `upgrades` / `downgrades`：
  - 仅统计 `admin.tenants.subscription.update`。
  - 通过同租户连续两次套餐变更比较等级推断（`FREE < BASIC < PRO`）。
- `churns`：`admin.tenants.lifecycle.suspend` + `admin.tenants.lifecycle.offboard`。
- `reactivations`：`admin.tenants.lifecycle.reactivate`。

## 4. 口径边界（v0）

- 当前未接真实订单系统，收入相关指标为“套餐映射估算值”。
- 升级/降级事件依赖审计日志连续性，不等价于财务记账口径。
- 统计窗口均按 UTC 日边界计算。
