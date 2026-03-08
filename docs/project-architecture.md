# Project Architecture（V4.2）

更新时间：2026-03-04
范围：`apps/web`、`apps/admin`、`apps/api`、`packages/shared`

## 1. 平台边界

| 平台域 | 主要职责 | 代码入口 | 边界约束 |
|---|---|---|---|
| 用户后台（Tenant Workspace） | 用户内管理：宠物/系列/账户/分享配置 | `apps/web/app/app/[tenantSlug]/*` | 仅操作当前用户数据，不做跨用户治理 |
| 公开分享端（Public Share） | 面向访客的只读浏览与转化入口 | `apps/web/app/public/s/[shareToken]/*` | 不提供写操作 |
| 平台管理后台（Platform Admin） | 跨用户治理、审计、分析 | `apps/admin/app/dashboard/*` | 仅 super admin 可访问 |
| API（统一后端） | 认证、用户隔离、业务接口、审计 | `apps/api/src/*` | `/admin/*` 与用户业务接口分域 |

## 2. 本轮架构收敛（核心）

### 2.1 产品管理入口收敛为“列表 + 抽屉”

- 统一入口组件：`apps/web/components/product-drawer.tsx`
- 抽屉实现拆分：
  - 创建：`apps/web/components/product-drawer/create.tsx`
  - 编辑：`apps/web/components/product-drawer/edit.tsx`
  - 共享逻辑：`apps/web/components/product-drawer/shared.ts`
- 旧管理页已退场：
  - `apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx` 仅做重定向回列表

结论：产品域从“列表 + 详情编辑页 + 图片页”收敛为“列表页内抽屉完成全流程”。

### 2.2 列表卡片与格式化能力共享化

- 共享卡片组件：
  - `apps/web/components/pet/pet-card.tsx`
  - `apps/web/components/pet/pet-card-badges.tsx`
- 共享格式化工具：`apps/web/lib/pet-format.ts`
- 共享筛选药丸样式：`apps/web/components/filter-pill.ts`

结论：后台与公开页在卡片、标签、格式化层已建立可复用基线，降低重复 CSS 与平行实现。

### 2.3 移动端筛选交互分支明确化

产品列表页（`apps/web/app/app/[tenantSlug]/products/page.tsx`）采用双分支策略：

- 顶部筛选按钮：锚点弹层（Popover）
- 悬浮筛选按钮（FAB）：底部抽屉（Bottom Sheet）

该分支直接由 `isMobileFilterLayout + showMobileFilterFab` 控制，避免交互歧义。

### 2.4 分享按钮打开策略稳态化

- 组件：`apps/web/components/tenant-floating-share-button.tsx`
- 策略：
  1. 先创建分享链接并尝试复制
  2. `window.open` 成功则直接打开
  3. 失败时降级为动态 `<a target="_blank">` 点击

结论：修复了“已打开但误报被拦截”的体验问题。

## 3. 请求链路（简版）

### 3.1 用户产品链路

1. 列表页加载：`GET /products`、`GET /series`
2. 新建抽屉：`POST /products` -> 上传/排序/主图设置（同抽屉内）
3. 编辑抽屉：`PUT /products/:id` + 图片 CRUD（同抽屉内）
4. 成功后局部刷新列表状态

### 3.2 公开分享链路

1. 用户端创建分享：`POST /shares`
2. 访客浏览：`GET /s/:shareToken` 或 `GET /shares/:shareId/public`
3. 公开页仅读，不触发写接口

### 3.3 平台管理链路

1. `apps/admin` 发起 `/admin/*` 请求
2. `apps/api` 通过 super admin 守卫鉴权
3. 写操作进入平台审计日志

## 4. 架构规则（MUST / SHOULD）

### MUST

- 产品创建、编辑、图片管理必须在统一抽屉流程内完成，不再新增独立管理页。
- 公共 UI 样式必须优先复用共享组件（`filter-pill`、`pet-card`、`pet-format`）。
- 公开分享端必须保持只读模型。
- 平台管理能力只能在 `apps/admin` + `/admin/*` 接口内实现。

### SHOULD

- 新增产品交互优先扩展 `product-drawer/shared.ts`，避免 create/edit 再次分叉。
- 后续若扩展筛选项，优先扩展当前药丸体系，不回退到原生低保真控件。
- 文档口径与实现保持同步，避免“页面已重构但文档仍描述旧页面”。

## 5. 当前已知边界风险

- `docs/spec/*` 中仍存在旧版产品页面叙述，后续需统一归档或更新。
- 旧路径虽然已重定向，但外部历史链接仍可能引用，需继续观察访问日志。
