# PRODUCTS Legacy Parity Checklist（T67 首个确认产物）

> 目标：对齐 `frontend/`（legacy turtle_album）与 `apps/web/`（multi-tenant 新 UI）在「产品管理」上的功能与交互，作为后续功能开发前的基线确认。

## 0. 对齐基线（必须遵守）

- **唯一允许差异**：
  1) 多租户作用域（`tenant` 维度）；
  2) 路由结构（`/admin/*` -> `/app/[tenantSlug]/*`）。
- **除上述两项外，产品管理行为应保持 1:1**。

---

## 1. 页面/组件映射总表（Legacy -> New）

| Legacy 页面/组件（代码路径） | New 页面/组件（代码路径） | 状态 | 备注 |
|---|---|---|---|
| `frontend/src/pages/admin/AdminProducts.tsx`（产品管理总入口，路由 `/admin/products`） | `apps/web/app/app/[tenantSlug]/products/page.tsx`（路由 `/app/[tenantSlug]/products`） | PARTIAL | 新页面有列表/搜索/新建/分享入口；但缺少 legacy 的编辑表单、删除、高级筛选、分页控制等。 |
| `frontend/src/pages/admin/products/ProductsToolbar.tsx`（搜索、导入、添加） | `apps/web/app/app/[tenantSlug]/products/page.tsx` 顶部“新建+搜索”区 | PARTIAL | 新 UI 缺少“批量导入”（`ProductImportDialog`）能力。 |
| `frontend/src/pages/admin/products/TurtleFilters.tsx`（性别/系列筛选） | `apps/web/app/app/[tenantSlug]/products/page.tsx` 搜索+封面筛选 | PARTIAL | 新 UI 仅有关键词+封面状态，本体业务筛选（性别/系列）缺失。 |
| `frontend/src/pages/admin/products/ProductsTableDesktop.tsx` + `ProductsListMobile.tsx` | `apps/web/app/app/[tenantSlug]/products/page.tsx` 内 table + mobile card | PARTIAL | 列表结构接近；但 legacy 有删除动作、分页器/每页条数、排序（code）；新 UI 无删除、无分页控件、无排序。 |
| `frontend/src/pages/admin/products/ProductSheet.tsx` + `ProductDetailView.tsx`（详情抽屉） | 无对应详情页（仅跳转图片页） | MISSING | 新 UI “编辑”按钮直达图片管理页，不含产品详情内容与详情态交互。 |
| `frontend/src/pages/admin/products/forms/ProductCreateDialog.tsx` + `ProductFormFields.tsx`（创建） | `apps/web/app/app/[tenantSlug]/products/page.tsx` 内嵌新建表单 | PARTIAL | 新 UI 仅 `code/name/description`，缺少 legacy 表单字段与条件逻辑。 |
| `frontend/src/pages/admin/products/forms/ProductEditForm.tsx`（编辑表单） | 无对应（`apps/web/.../products/[productId]/page.tsx` 仅图片管理） | MISSING | 新 UI 缺少产品字段编辑能力。 |
| `frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`（母龟事件） | 无对应 | MISSING | 新 UI 缺少母龟事件录入/查看。 |
| `frontend/src/pages/admin/products/images/ProductImagesManager.tsx` + `useProductImages.ts` | `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx` | PARTIAL | 上传/删除/设主图/调整顺序均有，但新 UI 仅上下移动，不支持拖拽与“置顶”；交互细节不一致。 |
| legacy 路由：`frontend/src/App.tsx` 中 `/admin/products` | 新路由：`/app/[tenantSlug]/products`、`/app/[tenantSlug]/products/[productId]` | MATCH | 属于“允许差异（路由+tenant）”。 |
| 新 UI 共享支撑：`apps/web/lib/api-client.ts`、`apps/web/lib/tenant-session.ts`、`packages/shared/styles/ui-foundation.css` | legacy 对应为 `frontend/src/services/*` + `frontend` UI 组件体系 | PARTIAL | 数据/样式基础设施不同（可接受），但产品行为仍需 1:1 对齐。 |

---

## 2. 用户流程与交互 Checklist（按业务动作）

### 2.1 列表与检索

- [x] **进入产品管理页**
  - Legacy: `/admin/products`（`frontend/src/App.tsx` -> `AdminProducts.tsx`）
  - New: `/app/[tenantSlug]/products`
  - 结论：**MATCH**（仅路由与租户域差异）

- [ ] **关键词搜索**
  - Legacy: `ProductsToolbar`（`searchQuery`）
  - New: 搜索框 + `loadProducts(search)`
  - 结论：**MATCH**

- [ ] **业务筛选（性别、系列）**
  - Legacy: `TurtleFilters.tsx`（`sex`, `series_id`）
  - New: 无，只有 `coverFilter`
  - 结论：**MISSING**

- [ ] **排序（按编号）**
  - Legacy: `ProductsTableDesktop` + `sortProductsByField`
  - New: 无排序交互
  - 结论：**MISSING**

- [ ] **分页与每页条数**
  - Legacy: 完整分页器 + 每页 20/50/100
  - New: 仅显示 `meta` 文案，不可切页
  - 结论：**MISSING**

- [ ] **删除产品**
  - Legacy: 列表操作含删除（确认弹窗）
  - New: 无删除入口
  - 结论：**MISSING**

### 2.2 新建与编辑

- [ ] **新建产品**
  - Legacy: `ProductCreateDialog` + `ProductFormFields` + `ProductImagesManager(create)`
  - New: 列表页内嵌表单（`code/name/description`）
  - 结论：**PARTIAL**（字段与创建流程不一致）

- [ ] **编辑产品字段**
  - Legacy: `ProductEditForm`
  - New: 无字段编辑页（`[productId]` 仅图片管理）
  - 结论：**MISSING**

- [ ] **详情查看（非编辑态）**
  - Legacy: `ProductDetailView`（大图+缩略图+描述）
  - New: 无对应详情态
  - 结论：**MISSING**

- [ ] **母龟事件管理（交配/产蛋）**
  - Legacy: `BreederEventsCard`
  - New: 无
  - 结论：**MISSING**

### 2.3 图片管理

- [x] **上传图片**：两端都有
- [x] **删除图片**：两端都有
- [x] **设为主图/封面**：两端都有
- [x] **调整顺序**：两端都有（交互细节不同）
- [ ] **拖拽排序 + 置顶快捷**：Legacy 有，New 无 -> **PARTIAL**

### 2.4 分享入口

- Legacy: 在 `frontend/src/pages/admin/products` 相关代码未发现产品分享入口。
- New: 列表提供“生成分享/打开分享”（`createShareRequestSchema` + `/shares`）。
- 结论：**PARTIAL（基线不一致）**。
  - 若坚持“除 tenant/路由外完全 1:1”，则该新增能力应通过需求确认后再保留（或临时 feature flag）。

---

## 3. Product 表单字段逐项对齐（基于 legacy `productSchema.ts` + `ProductFormFields.tsx`）

> 说明：以下“Legacy 是否可编辑”以 `ProductFormFields.tsx` 实际渲染为准；“New”以 `apps/web/app/app/[tenantSlug]/products/page.tsx` + `[productId]/page.tsx` 为准。

| 字段 | Legacy（schema/字段） | New（当前） | 状态 | 备注 |
|---|---|---|---|---|
| `code` | 可编辑，必填，自动大写 | 创建可填；编辑态无字段编辑 | PARTIAL | 缺少编辑态更新。 |
| `name` | schema 注释：不作为输入，后端用 `name=code` 规则 | 创建可选 `name` 字段；编辑态无 | PARTIAL | 语义已偏离 legacy 规则。 |
| `description` | 可编辑 | 创建可选；编辑态无 | PARTIAL | 缺少编辑态更新。 |
| `seriesId` | 可编辑（系列下拉） | 无 | MISSING | 影响产品归类。 |
| `sex` | 可编辑（公/母） | 无 | MISSING | 影响后续条件字段。 |
| `offspringUnitPrice` | 仅 `sex=female` 时显示 | 无 | MISSING | 母龟业务字段缺失。 |
| `sireCode` | 可编辑 | 无 | MISSING | 血缘字段缺失。 |
| `damCode` | 可编辑 | 无 | MISSING | 血缘字段缺失。 |
| `mateCode` | 可编辑（母龟场景） | 无 | MISSING | 配偶字段缺失。 |
| `excludeFromBreeding` | 仅母龟显示开关 | 无 | MISSING | 繁殖排除策略缺失。 |
| `isFeatured` | 可编辑开关 | 无 | MISSING | 无法在产品编辑中维护。 |
| `hasSample` | schema 有，默认 `false`；`ProductFormFields` 未渲染 | 无 | MATCH | 两端均未提供 UI 编辑。 |
| `inStock` | schema 有，默认 `true`；`ProductFormFields` 未渲染 | 无 | MATCH | 两端均未提供 UI 编辑。 |
| `popularityScore` | schema 有，默认 `0`；`ProductFormFields` 未渲染 | 无 | MATCH | 两端均未提供 UI 编辑。 |
| `price / cost_price` | legacy 创建时写死 `0`，无表单项 | 无 | MATCH | 两端均未开放。 |

---

## 4. 图片管理 Parity（upload / delete / reorder / set cover）

### 4.1 Legacy 行为（`ProductImagesManager.tsx` + `useProductImages.ts`）

- 上传：
  - create 模式先本地预览，产品创建后批量上传；
  - edit 模式即时上传并刷新列表。
- 删除：支持删除当前图（edit 模式有确认）。
- 设主图：支持，且会尝试把主图置顶并持久化顺序。
- 排序：
  - 支持拖拽排序（DnD）；
  - 支持左移/右移/置顶；
  - 有“保存排序”动作与失败提示。

### 4.2 New 行为（`apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx`）

- 上传：即时上传（多文件循环调用上传）。
- 删除：即时删除并刷新。
- 设主图：即时调用 `/main`。
- 排序：仅“上移/下移”，即时调用 `/reorder`。

### 4.3 结论

- 能力覆盖层面：`upload/delete/set-main/reorder` 为 **PARTIAL**（主流程存在）。
- 交互与容错层面：与 legacy 存在明显差异（无拖拽、无置顶、无显式保存流程），不满足严格 1:1。

---

## 5. 允许差异声明（再次确认）

当前对比中，**仅以下差异可直接接受**：

1. 租户作用域（`tenantSlug` + `switchTenantBySlug`）；
2. 路由从 `/admin/products` 迁移到 `/app/[tenantSlug]/products*`。

其余行为差异（字段、流程、交互、权限动作）均应视为 **parity gap**。

---

## 6. Gaps -> Next Tasks（可直接排期）

1. **补齐产品编辑页（P0）**
   - 在 `apps/web` 增加产品详情+编辑能力（或将 `[productId]` 扩展为“详情+表单+图片”）。
   - 字段最小集合对齐 legacy：`seriesId/sex/offspringUnitPrice/sireCode/damCode/mateCode/excludeFromBreeding/isFeatured/description/code`。

2. **补齐列表筛选/排序/分页（P0）**
   - 增加 `sex`、`series` 筛选；
   - 增加按 `code` 排序；
   - 增加分页控件与每页条数设置（20/50/100）。

3. **补齐删除产品动作（P0）**
   - 列表增加删除入口与确认机制。

4. **图片交互对齐 legacy（P1）**
   - 增加拖拽排序、置顶快捷与更清晰的排序持久化反馈。

5. **母龟事件卡片迁移（P1）**
   - 对齐 `BreederEventsCard` 交配/产蛋事件录入与最近事件查看。

6. **分享入口策略确认（P1）**
   - 现状：new 有、legacy 无；与“严格 1:1”冲突。
   - 需产品/研发确认：保留为新增能力（补基线说明）或临时收敛为 parity 模式。

---

## 7. 本文覆盖的主要代码路径

- New:
  - `apps/web/app/app/[tenantSlug]/products/page.tsx`
  - `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx`
  - `apps/web/lib/api-client.ts`
  - `apps/web/lib/tenant-session.ts`
  - `packages/shared/styles/ui-foundation.css`
- Legacy:
  - `frontend/src/App.tsx`
  - `frontend/src/pages/admin/AdminProducts.tsx`
  - `frontend/src/pages/admin/products/ProductDetailView.tsx`
  - `frontend/src/pages/admin/products/forms/productSchema.ts`
  - `frontend/src/pages/admin/products/forms/ProductFormFields.tsx`
  - `frontend/src/pages/admin/products/forms/ProductCreateDialog.tsx`
  - `frontend/src/pages/admin/products/forms/ProductEditForm.tsx`
  - `frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`
  - `frontend/src/pages/admin/products/images/ProductImagesManager.tsx`
  - `frontend/src/pages/admin/products/images/useProductImages.ts`
  - `frontend/src/pages/admin/products/ProductsToolbar.tsx`
  - `frontend/src/pages/admin/products/TurtleFilters.tsx`
  - `frontend/src/pages/admin/products/ProductsTableDesktop.tsx`
  - `frontend/src/pages/admin/products/ProductsListMobile.tsx`
