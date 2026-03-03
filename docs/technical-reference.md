# Technical Reference（业务口径 + 规则）

更新时间：2026-03-03（V4.1：分享入口浮动化 + 公开系列页交互补全）  
范围：`apps/api`、`packages/shared`、`legacy/backend`

## 0. 业务主线（先讲清楚我们在卖什么）

蛋龟选育库当前主线不是“单纯记档案”，而是三段价值链：

1. 先把种龟与繁育事件结构化记录清楚（可追溯）。
2. 再把血缘关系和公开页展示出来（可解释）。
3. 最终进入证书/品牌化与 AI 提效（可成交）。

对应技术落点：
- 主实体是 `products`（种龟档案）。
- 繁育事实沉淀在 `product_events`（交配/产蛋/换配）。
- 对外展示通过 `public_shares`。
- 商业分层靠订阅额度（先控龟只数量，再叠加高级能力）。

## 1. 术语与实体口径

### 1.1 主线术语（Node）

- `product`：统一业务主实体（繁育语义下就是“种龟档案”）。
- `breeders`：前端历史命名视图；后端主线已收敛到 `products`。
- `series`：品系/系列维度，用于筛选与同系列配对校验。
- `product_events`：种龟事件时间线（`mating`/`egg`/`change_mate`）。
- `tenant`：多租户隔离边界。

### 1.2 面向业务的话术口径

- `种龟`：可参与繁育的产品档案（含 `sex`、父母编码、配偶、事件）。
- `子龟`：按父母编码反推得到的后代（`sire_code`/`dam_code`）。
- `待配`：母龟有产蛋，但产蛋后未出现新的交配记录。
- `加配`：同一母龟追加交配记录（可多次）。
- `换配`：母龟当前 `mate_code` 发生变更（触发 `change_mate` 事件）。

## 2. 套餐控制点（已简化口径）

### 2.1 数量控制（当前生效）

- 免费版：默认 10 只。
- 初级版：默认 30 只。
- 高级版：默认 200 只。
- 若订阅记录里配置了 `maxShares`，当前实现会把它作为“种龟上限覆盖值”使用。

代码证据：
- `apps/api/src/subscriptions/tenant-subscriptions.service.ts`（`PLAN_PRODUCT_LIMITS`、`resolveMaxProductsLimit`、`assertProductCreateAllowed`）
- `apps/api/src/products/products.service.ts`（`createProduct` 开始即校验额度）

### 2.2 分享控制（当前生效）

- 分享链接不按创建次数限额做拦截。
- 分享访问走签名参数，链接按过期时间失效。
- 套餐核心控制点转为“写状态 + 种龟数量”。

代码证据：
- `apps/api/src/shares/shares.service.ts`（分享创建逻辑未做 `maxShares` 拦截）
- `apps/api/src/subscriptions/tenant-subscriptions.service.ts`（写权限与额度校验在订阅服务）
- `scripts/api-tests/subscription.ts`（`maxShares=1` 下可连续创建分享）

### 2.3 AI 能力口径（产品已定、实现分阶段）

- 三档套餐都有限次。
- 支持单独购买次数包，支持多次充值叠加。
- 免费用户可体验自动记录（10 次）作为转化入口。
- 现阶段 `ai-assistant` 相关接口为占位实现，后续接管理员智能体自动入库与智能问数。

### 2.4 分享端 IA 与回流契约（V4 冻结）

- 分享端底部导航固定三项：`系列 / 宠物 / 我的`（`宠物`为中间高亮）。
- 分享端读链路固定为：
  - `/public/s/[shareToken]`（宠物）
  - `/public/s/[shareToken]/series`（系列）
  - `/public/s/[shareToken]/me`（转化页）
- 分享端默认不打断：进入页面不弹鉴权，不强制登录。
- 仅当用户主动点击“我的页 CTA”时进入鉴权流程。
- 登录回流默认：`/app?intent=dashboard&source=share`。
- `next` 只接受站内相对路径；外链或非法值必须回退 `/app?intent=dashboard`。

### 2.5 租户侧分享入口与意图映射（V4.1）

- 移动端租户后台已移除 Dock 内“分享”一级项，改为 Dock 上方悬浮按钮。
- 悬浮按钮行为（前端）：
  1. `GET /me` 读取当前 `tenantId`
  2. `POST /shares` 创建 `tenant_feed` 分享链接
  3. 按当前页面意图跳转公开页
- 公开页意图映射：
  - 默认：`/public/s/{shareToken}`
  - 系列页：`/public/s/{shareToken}/series`
  - 宠物详情页（`products/:id` 或 `breeders/:id`）：`/public/s/{shareToken}/products/{id}`
- 本次只调整入口与跳转策略，无新增后端 API、无数据模型变更。

代码证据：
- `apps/web/app/app/[tenantSlug]/layout.tsx`
- `apps/web/components/tenant-floating-share-button.tsx`

## 3. 已继承并在 Node 生效的繁育规则

本节是“Legacy 规则 -> Node 落地”的确认清单。

### 3.1 字段与更新规则

- `MUST`：`offspringUnitPrice` 只允许母龟（`sex=female`）。
- `MUST`：如果改成非母龟，自动清空 `offspringUnitPrice`。
- `MUST`：`code/sireCode/damCode/mateCode` 写入时统一大写。
- `MUST`：`code` 在租户内按不区分大小写唯一校验。

代码证据：
- `packages/shared/src/product.ts`（`createProductRequestSchema`、`updateProductRequestSchema` 跨字段约束）
- `apps/api/src/products/products.service.ts`（`createProduct`、`updateProduct`）
- `apps/api/src/products/breeding-rules.ts`（`normalizeCodeUpper`）
- `scripts/api-tests/products.ts`（male+price 拒绝、female->male 自动清空回归）

### 3.2 交配/产蛋/手工事件写入规则

- `MUST`：`POST /products/mating-records` 校验“同系列 + 母龟 female + 公龟 male”。
- `MUST`：`POST /products/egg-records` 只允许母龟写产蛋。
- `MUST`：`POST /products/:id/events` 支持 `eventType=mating|egg|change_mate`，并支持 `mm.dd` 日期简写。
- `MUST`：`POST /products/:id/events` 当前只接受母龟 `productId`（与繁育事件口径一致）。
- `MUST`：事件 `note` 支持结构化标签（如 `#maleCode=...`、`#eggCount=...`）。

代码证据：
- `apps/api/src/products/products.controller.ts`（新写入接口）
- `apps/api/src/products/products.service.ts`（`createMatingRecord`、`createEggRecord`、`createProductEvent`）
- `apps/api/src/products/breeding-rules.ts`（`parseEventDateInput`、`buildTaggedNote`）
- `packages/shared/src/product.ts`（对应 request/response schema）

### 3.3 换配自动事件与过渡期标注

- `MUST`：母龟 `mateCode` 变化时，自动追加 `change_mate` 事件。
- `MUST`：描述文本支持 Legacy 过渡标注规则：
  - 识别 `M.D 更换配偶为X公`
  - 通过 `#TA_PAIR_TRANSITION=<n>` 记录剩余过渡计数
  - 新增产蛋行前两次可自动追加 `-换公过渡期`

代码证据：
- `apps/api/src/products/products.service.ts`（`updateProduct` 中 `mateCodeChanged` 自动写事件）
- `apps/api/src/products/breeding-rules.ts`（`processPairTransitionDescription`）

### 3.4 当前配偶解析优先级（产品端 + 分享端已统一）

顺序：

1. `mateCode` 显式值
2. 描述里最近一条“更换配偶为...”
3. 最近交配事件里的 `#maleCode`

代码证据：
- `apps/api/src/products/products.service.ts`（`resolveCurrentMateCode`）
- `apps/api/src/shares/shares.service.ts`（`resolveCurrentMateCode`）
- `apps/api/src/products/breeding-rules.ts`（`parseCurrentMateCode`、`canonicalMateCodeCandidates`）

### 3.5 待配/预警规则（分享端已继承）

- `MUST`：无产蛋 -> `normal`
- `MUST`：存在“产蛋之后的交配” -> `normal`
- `MUST`：有产蛋但无后续交配 -> `need_mating`
- `MUST`：`daysSinceEgg >= 25` -> `warning`
- `MUST`：`excludeFromBreeding=true` -> `normal`

代码证据：
- `apps/api/src/shares/shares.service.ts`（`resolveNeedMatingStatus`、`buildPublicMaleMateLoad`）

### 3.6 编码检索与排序规则

- `MUST`：列表支持 `code` 精确查询（忽略大小写）。
- `MUST`：按 `sortBy=code` 时使用自然排序（数字按数值比较）。
- `MUST`：家族树配偶匹配支持 `公` 后缀候选（`A1` 与 `A1公` 兼容）。

代码证据：
- `apps/api/src/products/products.service.ts`（`listProducts`、`compareProductCode`、`getProductFamilyTree`）
- `apps/api/src/products/breeding-rules.ts`（`canonicalMateCodeCandidates`）

### 3.7 审计动作（已补齐）

- 已新增并落地：
  - `product.update`
  - `product.event.create`

代码证据：
- `packages/shared/src/audit.ts`
- `apps/api/src/products/products.service.ts`（写入与更新处调用审计）

## 4. 业务链路（代码视角）

### 4.1 从录入到繁育

1. 创建种龟：`POST /products`（先校验租户可写 + 数量额度）。
2. 补充结构：更新 `sex/sireCode/damCode/mateCode/description`。
3. 写事件：交配、产蛋、换配时间线进入 `product_events`。
4. 查关系：`GET /products/:id/family-tree` 聚合父母、配偶、子代。

### 4.2 从繁育到展示

1. 创建分享：`POST /shares` 生成公开 token。
2. 访问公开页：`GET /s/:shareToken` 或 `GET /shares/:shareId/public`。
3. 公龟负载与待配预警：在公开域按 25 天规则返回 `normal/need_mating/warning`。

### 4.3 分享端转化链路（V4）

1. 访客浏览：在 `宠物/系列` 页面完成内容消费（只读）。
2. 访客转化：进入 `我的` 查看免费卡片与能力介绍。
3. 访客鉴权：点击 `注册并开始` 或 `已有账号登录` 后再进入 `/login`。
4. 成功回流：注册/登录完成后进入 `/app?intent=dashboard&source=share`。

### 4.4 公开系列页交互补全（V4.1）

- 系列页新增“当前页二维码”浮动操作，位置与底部 Dock 安全区对齐。
- 二维码在本地生成（浏览器侧），不依赖第三方二维码服务。
- 系列说明为空时展示“暂无系列介绍”占位，不再整卡隐藏。

代码证据：
- `apps/web/app/public/s/[shareToken]/series/page.tsx`
- `apps/web/app/public/_shared/public-floating-actions.tsx`
- `apps/web/app/public/_public-product/components.tsx`

## 5. 数据模型字段与业务关联（Prisma）

来源：`apps/api/prisma/schema.prisma`

### 5.1 用户/租户/权限域

- `users`：账号主体。
- `auth_codes`：验证码登录链路。
- `tenants`：业务空间。
- `tenant_members`：租户成员与角色（RBAC 基础）。

关联：
- `users` <-> `tenant_members` <-> `tenants`（多对多成员关系）。

### 5.2 订阅域

- `tenant_subscriptions`：租户生效套餐与配额（含 `max_shares`，当前被复用于产品上限覆盖）。
- `subscription_activation_codes`：激活码发行与核销。

关联：
- `tenants(1) -> tenant_subscriptions(1)`
- `tenants(1) -> subscription_activation_codes(n)`（可按目标租户绑定）

### 5.3 种龟主域

- `products`：种龟主档（编码、性别、父母、配偶、库存状态、繁育标记）。
- `product_events`：事件事实表（交配/产蛋/换配）。
- `product_images`：图片资源表。
- `series`：品系维度。
- `featured_products`：推荐位映射。

关联：
- `products.tenant_id` 保证租户隔离。
- `products.series_id -> series.id`。
- `product_events.product_id -> products.id`（时间线）。
- `product_images.product_id -> products.id`（图册）。
- `products.sire_code/dam_code/mate_code` 为编码级软关联（非外键）。

### 5.4 分享与审计域

- `public_shares`：公开分享入口与 token。
- `tenant_share_presentation_configs`：公开页品牌配置。
- `audit_logs`：租户内操作与访问审计。
- `super_admin_audit_logs`：平台管理操作审计。

关联：
- 分享访问行为会落入 `audit_logs`（用于公开访问统计）。

## 6. 当前未完工能力（明确状态）

1. 证书生成主链路：模板渲染、签发、验真还未全链路落地（你已明确要做）。
2. 图片水印：高级版能力口径已定，尚未在主链路实现。
3. AI 自动记录：目标是管理员智能体意图识别后自动写库，当前为占位接口阶段。
4. 智能问数：后续可复用 AI 次数体系，接口可预留，查询引擎待实现。
5. 分享端 V4 新页面（`/public/s/[shareToken]/series`、`/public/s/[shareToken]/me`）与 Dock 组件仍需完整落地。

## 7. 文档分工（避免重复）

- 商业叙事：`docs/business-flows.md`
- 页面/路由/API 全清单：`docs/api-views.md`
- 本文：业务规则、数据关联、继承状态与技术口径
