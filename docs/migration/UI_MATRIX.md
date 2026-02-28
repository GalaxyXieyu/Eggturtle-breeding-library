# MIGRATION_UI_MATRIX（Legacy 前端 -> Node Web/Admin 页面功能对照）

更新日期：2026-02-28

目的：把 legacy 前端（`frontend/`）的页面/功能点梳理出来，并对照 Node 端（`apps/web` + `apps/admin`）目前是否有对应页面。

说明：

- 这里是“页面级/功能入口级”的梳理，不代表每个按钮/交互细节都完全一致。
- Node `apps/admin` 当前定位是“平台级 backoffice”（tenant/membership/audit），不是 legacy 的“运营管理后台（产品/种龟/系列/轮播/设置）”。

---

## 1. Legacy 前端页面清单（Vite React：`frontend/src/pages`）

用户侧（核心业务）：

- `frontend/src/pages/SeriesFeed.tsx`：系列流/展示入口
- `frontend/src/pages/BreederDetail.tsx`：种龟详情（谱系/父母/祖代/子代/事件/记录等）
- `frontend/src/pages/NotFound.tsx`

运营/管理侧（legacy admin 区）：

- `frontend/src/pages/admin/AdminLogin.tsx`
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminProducts.tsx`
- `frontend/src/pages/admin/AdminSeries.tsx`
- `frontend/src/pages/admin/AdminFeaturedProducts.tsx`
- `frontend/src/pages/admin/AdminCarouselManager.tsx`
- `frontend/src/pages/admin/AdminSettings.tsx`

管理侧子模块（强相关组件）：

- `frontend/src/pages/admin/products/images/ProductImagesManager.tsx`（图片管理）
- `frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`（种龟事件卡片，说明 admin 端与 breeders/events 强耦合）

---

## 2. Node Web（Next：`apps/web`）现有页面清单

从 `apps/web/app/**/page.tsx` 统计：

- `/` -> `apps/web/app/page.tsx`（redirect 到 /app）
- `/login` -> `apps/web/app/login/page.tsx`（邮箱验证码登录）
- `/tenant-select` -> `apps/web/app/tenant-select/page.tsx`（选择/创建 tenant）
- `/app` -> `apps/web/app/app/page.tsx`（resolve tenant 并跳转）
- `/app/[tenantSlug]` -> `apps/web/app/app/[tenantSlug]/page.tsx`（tenant-scoped v0 dashboard，仅展示 /me）
- `/app/[tenantSlug]/tenants` -> `apps/web/app/app/[tenantSlug]/tenants/page.tsx`（tenant 管理）
- `/app/[tenantSlug]/featured-products` -> `apps/web/app/app/[tenantSlug]/featured-products/page.tsx`
- `/public/share` -> `apps/web/app/public/share/page.tsx`（public share demo）
- `/admin` -> `apps/web/app/admin/page.tsx`（跳转提示 admin moved）

---

## 3. Node Admin（Next：`apps/admin`）现有页面清单

从 `apps/admin/app/**/page.tsx` 统计：

- `/` -> `apps/admin/app/page.tsx`
- `/login` -> `apps/admin/app/login/page.tsx`
- `/dashboard` -> `apps/admin/app/dashboard/page.tsx`
- `/dashboard/tenants` -> `apps/admin/app/dashboard/tenants/page.tsx`
- `/dashboard/tenants/[tenantId]` -> `apps/admin/app/dashboard/tenants/[tenantId]/page.tsx`
- `/dashboard/memberships` -> `apps/admin/app/dashboard/memberships/page.tsx`
- `/dashboard/audit-logs` -> `apps/admin/app/dashboard/audit-logs/page.tsx`

---

## 4. 页面功能对照（结论表）

| Legacy 页面/功能 | Node Web（apps/web） | Node Admin（apps/admin） | 覆盖状态 | 备注 |
| --- | --- | --- | --- | --- |
| 系列流（SeriesFeed） | 无 | 无 | 缺失 | 需要先补 series API + web 页面 |
| 种龟详情（BreederDetail：谱系/事件/记录） | 无 | 无 | 缺失（核心） | 对应 breeders/events/family-tree API 缺失 |
| 产品运营后台（AdminProducts：CRUD/图片/导入） | 仅有 featured-products 页（非常简化） | 无 | 部分/不等价 | Node API 有 products+images，但 UI 管理页未见 |
| 系列管理（AdminSeries） | 无 | 无 | 缺失 | Node 还没有 series 模块 |
| 精选管理（AdminFeaturedProducts） | 有：`/app/[tenantSlug]/featured-products` | 无 | 覆盖（基本） | 语义需确认（legacy PUT vs Node reorder） |
| 轮播管理（AdminCarouselManager） | 无 | 无 | 缺失 | Node 还没有 carousels 模块 |
| 设置（AdminSettings） | 无 | 无 | 缺失 | Node 还没有 settings 模块 |
| 平台级 tenant 管理 | 有 tenant-select/tenant 管理入口（偏自助） | 有 dashboard tenants/memberships/audit | Node 新增能力 | 与 legacy 不同的 SaaS 平台定位 |

---

## 下一步建议（UI 视角）

如果目标是尽快让 Node Web 能替代 legacy 用户侧：

1) 先补“只读链路”：Series 列表 -> Breeders 列表 -> Breeder 详情（含 events 时间线、family-tree）。
2) 再补“写入链路”：交配/产蛋/换公等结构化事件写入（可能先从 admin/内部入口开始）。
3) 最后补运营向：轮播/设置/批量导入。
