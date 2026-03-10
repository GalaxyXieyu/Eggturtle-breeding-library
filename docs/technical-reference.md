# Technical Reference（V4.2）

更新时间：2026-03-04
范围：`apps/web`、`apps/admin`

## 1. 术语与边界

- `ProductDrawer`：产品创建/编辑统一交互入口（不是单一实现文件）。
- `PetCard`：后台与公开页共享卡片骨架。
- `Filter Pill`：筛选药丸按钮共享样式构建器。
- `Legacy Product Manage Page`：`/app/[tenantSlug]/products/[productId]` 旧管理页，已退役。

## 2. 组件复用契约

### 2.1 Product Drawer（MUST）

实现锚点：
- `apps/web/components/product-drawer.tsx`
- `apps/web/components/product-drawer/create.tsx`
- `apps/web/components/product-drawer/edit.tsx`
- `apps/web/components/product-drawer/shared.ts`

规则：
- `mode='create' | 'edit'` 必须通过统一入口 `ProductDrawer` 分发。
- 图片操作与资料编辑必须在抽屉内完成，不允许再引入“跳转图片管理页”流程。
- 创建/编辑共同规则（解析系列、校验热度分、价格逻辑）必须落在 `shared.ts`。

### 2.2 状态切换控件（MUST）

实现锚点：`apps/web/components/product-drawer/status-toggle-group.tsx`

规则：
- 产品状态字段（`excludeFromBreeding`、`hasSample`、`inStock`、`isFeatured`）必须使用药丸切换控件。
- 禁止回退到原生 checkbox 样式作为主交互。

### 2.3 Pet Card 与格式化工具（SHOULD）

实现锚点：
- `apps/web/components/pet/pet-card.tsx`
- `apps/web/components/pet/pet-card-badges.tsx`
- `apps/web/lib/pet-format.ts`

规则：
- 页面层应优先复用 `PetCard` 与 `pet-format`，避免重复格式化函数。
- 若新增展示标签，优先扩展 `pet-card-badges.tsx`，不要在页面散落实现。

### 2.4 筛选药丸样式（MUST）

实现锚点：`apps/web/components/filter-pill.ts`

规则：
- 后台与公开页筛选药丸必须通过 `buildFilterPillClass` 生成样式。
- 不允许同类筛选按钮在页面内独立拼接另一套视觉规范。

## 3. 交互逻辑契约

### 3.1 产品列表筛选分支（MUST）

实现锚点：`apps/web/app/app/[tenantSlug]/products/page.tsx`

规则：
- 顶部筛选按钮：打开锚点弹层（Popover）。
- 悬浮筛选 FAB：打开底部抽屉（Bottom Sheet）。
- 决策条件必须由 `isMobileFilterLayout + showMobileFilterFab` 控制。

### 3.2 抽屉关闭按钮位置（MUST）

实现锚点：`apps/web/components/product-drawer/create.tsx`、`apps/web/components/product-drawer/edit.tsx`

规则：
- 抽屉关闭按钮统一放右上角。
- 关闭按钮样式在 create/edit 中保持一致，不做左/右混用。

### 3.3 分享按钮打开策略（MUST）

实现锚点：`apps/web/components/tenant-floating-share-button.tsx`

规则：
- 分享链接创建后，先尝试 `window.open`。
- 若返回空对象，必须走 `<a target="_blank">` 降级策略。
- 不应在“已成功打开”的场景继续提示“浏览器拦截”。

## 4. 路由退役与兼容策略

实现锚点：`apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx`

规则：
- 旧产品管理页只允许做重定向，不再承载编辑业务。
- 新交互能力必须回归 `/app/[tenantSlug]/products`。

## 5. 证书二维码与扫码落地口径

### 5.1 证书二维码内容（验真 URL）
- 证书 PNG 的二维码内容为「证书验真页」URL，路径固定：
  - `/public/certificates/verify/:verifyId`
- URL 组装逻辑在 API 端生成证书时完成：
  - `apps/api/src/products/product-generated-assets-support.service.ts`
    - `buildPublicVerifyUrl(verifyId)`

### 5.2 公网 baseUrl 选择（按优先级）
二维码的公网域名（baseUrl）按以下优先级取值：
1. `PUBLIC_VERIFY_BASE_URL`（推荐：专用于验真页的公网域名）
2. `PUBLIC_WEB_BASE_URL`（备用：公开 Web 域名）
3. `NEXT_PUBLIC_PUBLIC_APP_ORIGIN`（兼容：与 Web 端公开/分享域名一致）

> 会自动 trim，并去掉末尾 `/`。

### 5.3 扫码落地页口径
- 扫码落地页为 Web 端公开页面（验真页）：
  - `apps/web/app/public/certificates/verify/[verifyId]/page.tsx`
- 该页面展示：证书正文预览、血统快照、成交摘要等。
- 用户口径映射：
  - 文案中「母龟详情页」= 代码中的「宠物详情页」（public product 页面），但 **证书二维码落地必须是验真页**，避免误跳转到宠物详情页导致展示“微信联系”等模块。

## 5. Admin 端口径补充

实现锚点：`apps/admin/lib/formatters.ts`

规则：
- 管理端页面统一复用 `formatDateTime`、`formatUnknownError`，减少页面内重复错误处理。

## 6. 反模式清单（禁止）

- 在页面内再造一套产品抽屉逻辑（平行 create/edit）。
- 在页面内复制筛选按钮样式字符串而不走 `filter-pill`。
- 重新启用独立产品管理页承载编辑与图片上传。
- 在分享按钮里直接把 `window.open` 失败当强错误，不做降级。

## 7. 维护建议

- 涉及以下文件变更时，必须同步更新文档：
  - `apps/web/app/app/[tenantSlug]/products/page.tsx`
  - `apps/web/components/product-drawer/*`
  - `apps/web/components/filter-pill.ts`
  - `apps/web/components/tenant-floating-share-button.tsx`
  - `apps/web/components/pet/*`
