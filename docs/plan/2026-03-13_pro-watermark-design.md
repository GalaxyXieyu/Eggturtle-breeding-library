# Pro 会员水印功能调研与设计方案（2026-03-13）
> 结论先行：当前仓库里**已经有“水印”相关字段、快照与文案**，但主要集中在**证书 / 夫妻图生成链路**，且呈现为**“已预埋、未完全生效”**状态；**公开分享海报链路目前没有水印配置与水印绘制实现**。因此本期最稳妥的方案不是“大改原图/公开资源链路”，而是先把 **Pro 的“商家水印能力”收敛到 3 条明确生成链路**：`分享海报`、`夫妻图`、`证书图`。

---

## 1. 本次调研范围

基于真实仓库代码与真实文件结构，重点检查以下内容：

1. 当前已有的 Pro / 会员模型、权益文案、套餐结构。
2. 当前分享 / 海报 / 图片 / 导出 / 证书 / 夫妻图链路中，是否已有水印实现或半成品。
3. 哪些入口和配置页适合承接“Pro 会员水印功能”。
4. 是否适合当前阶段直接改代码。

本次**未直接修改业务代码**；仅新增方案文档，避免在需求未定前引入行为变更。

---

## 2. 现状结论（基于仓库证据）

### 2.1 会员 / Pro 现状

- 当前订阅模型是 `FREE / BASIC / PRO` 三档。
- 订阅表 `tenant_subscriptions` 现有字段：`plan / startsAt / expiresAt / maxImages / maxStorageBytes / maxShares`。
- `TenantSubscriptionGuard` 只校验“当前租户是否可写”，**不是 Pro 专属能力开关**。
- 当前 `maxShares` 字段名虽然叫“分享额度”，但管理端文案已经明确说明：**仍沿用为产品数量覆盖值，不限制分享创建次数**。

### 2.2 已有“图片水印能力”宣传口径

仓库中已经把“图片水印能力”写进了 PRO 套餐卖点：

- 用户端订阅页：PRO perks 包含“证书能力 / 图片水印能力 / 高配额与品牌化展示”。
- 公开分享落地页（分享给访客看的套餐页）也有同样表述。

**这意味着产品口径已经存在，但实现尚未闭环。**

### 2.3 分享 / 海报链路现状

- 分享弹窗会生成：`公开链接 + 二维码 + 海报`。
- 当前海报是 **前端 Canvas 生成**，主要实现位于 `apps/web/lib/share-poster.ts`。
- 当前分享配置模型 `tenantSharePresentationSchema` 只有：
  - 标题 / 副标题
  - 主副品牌色
  - Hero 图
  - 微信二维码 / 微信号
- **没有任何 watermark / 水印字段**。
- 当前分享配置页面 `/app/[tenantSlug]/share-presentation` 的表单字段也没有水印配置。
- 产品抽屉里还明确写了：
  - “先把分享动作做轻，不把用户推进海报生成链路。”
  - “只做入口，不做海报编辑。”

这说明：

1. 当前分享能力已经上线，但偏轻量。
2. 当前并不适合直接做复杂海报编辑器。
3. 如果做水印，应优先做**轻配置 + 稳定渲染**，不要演变成海报模板系统。

### 2.4 证书链路现状

证书链路里已经有明显的“水印半成品”：

- `buildWatermarkText(tenantName)` 已存在，当前默认返回：`{tenantName} · 珍藏证书`。
- 证书生成时会：
  - 把 `watermarkText` 传入证书渲染 style；
  - 把 `watermarkSnapshot` 写入数据库；
  - 对外验真接口返回 `watermarkSnapshot`。
- 但在实际 SVG 模板里：
  - `CertificateStyleInput` 定义了 `watermarkText`；
  - 最终绘制位置显示的却是 `verificationStatementZh`，**不是 `watermarkText`**。

结论：

- **证书链路已具备“水印配置快照与传参”的基础设施。**
- 但**当前模板没有真正把 `watermarkText` 绘制出来**，属于“已预埋、未闭环”。

### 2.5 夫妻图链路现状

夫妻图链路同样存在“水印半成品”：

- 生成时会构造 `watermarkSnapshot` 并落库。
- 渲染 style input 中也定义了 `watermarkText`。
- 但当前 SVG 模板里**没有发现 `input.watermarkText` 的实际输出**。

结论：

- 夫妻图与证书一样，**已经有数据层与渲染入参层的准备**；
- 但**尚未把水印真正画到图上**。

### 2.6 证书/夫妻图当前是否已被 Pro 强限制？

- 当前产品写接口统一挂了 `TenantSubscriptionGuard`，表示“租户可写”即可。
- 证书还有独立的**固定月额度**（`CERTIFICATE_MONTHLY_LIMIT = 100`）。
- 现有证书额度实现**没有按 FREE / BASIC / PRO 区分**。

结论：

- 当前“证书能力 / 图片水印能力”更多还是**产品口径**，并非已经严格按 Pro 权益控制。
- 如果上线 Pro 水印功能，需要**补真正的权益判定层**。

---

## 3. 现状证据索引

以下均为本次实际确认到的仓库证据：

### 3.1 会员 / Pro / 权益

- `apps/api/prisma/schema.prisma`
  - `TenantSubscription` 模型：`plan / maxImages / maxStorageBytes / maxShares`
- `packages/shared/src/subscription.ts`
  - 订阅接口契约与字段定义
- `packages/shared/src/subscription-catalog.ts`
  - `FREE / BASIC / PRO` 套餐价格与产品上限
- `apps/api/src/auth/tenant-subscription.guard.ts`
  - 仅校验 writable，不是 Pro 特权控制
- `apps/admin/lib/locales/tenant-detail.ts`
  - 明确写明 `maxShares` 当前不限制分享创建次数

### 3.2 已有“图片水印能力”文案

- `apps/web/app/app/[tenantSlug]/subscription/page.tsx`
- `apps/web/app/public/_shared/public-share-me-page.tsx`
- `apps/web/components/referral-promo-card.tsx`

### 3.3 分享 / 海报 / 配置

- `apps/web/lib/share-poster.ts`
  - 海报前端 Canvas 生成
- `apps/web/components/tenant-share-dialog-trigger.tsx`
  - 分享弹窗、二维码、海报下载
- `packages/shared/src/share.ts`
  - 分享配置 schema，无水印字段
- `apps/web/app/app/[tenantSlug]/share-presentation/page.tsx`
  - 分享配置页字段，无水印配置
- `apps/api/prisma/schema.prisma`
  - `PublicShare` 与 `TenantSharePresentationConfig` 模型
- `apps/web/components/breeder-detail/BreederAssetWorkflowDrawer.tsx`
  - 当前策略明确“不做海报编辑”

### 3.4 证书 / 夫妻图 / 水印半成品

- `apps/api/src/products/product-generated-assets-support.service.ts`
  - `buildWatermarkText()`
- `apps/api/src/products/product-certificates.service.ts`
  - 证书生成时传入 `watermarkText`
- `apps/api/src/products/product-certificates.utils.ts`
  - `buildCertificateWatermarkSnapshot()`
- `apps/api/src/products/rendering/certificate-style.ts`
  - 定义了 `watermarkText` 入参，但最终绘制未使用
- `apps/api/src/products/product-couple-photos.service.ts`
  - 夫妻图生成时传入并落库 `watermarkSnapshot`
- `apps/api/src/products/rendering/couple-photo-style.ts`
  - 定义了 `watermarkText` 入参，但未见实际绘制
- `apps/api/prisma/schema.prisma`
  - `ProductCertificate.watermarkSnapshot`
  - `ProductCouplePhoto.watermarkSnapshot`
- `packages/shared/src/certificate-assets.ts`
  - 对外 schema 已返回 `watermarkSnapshot`
- `apps/api/src/products/product-certificate-verification.service.ts`
  - 验真接口对外返回 `watermarkSnapshot`
- `apps/web/app/public/certificates/verify/[verifyId]/page.tsx`
  - 页面已有“商家水印”展示文案，但当前是固定说明文案

---

## 4. 问题定义

当前最大的矛盾不是“完全没有水印基础”，而是：

1. **产品已经宣称 PRO 有图片水印能力**；
2. **代码里已经有 watermarkText / watermarkSnapshot 半成品**；
3. 但用户真正能感知到的分享海报 / 证书 / 夫妻图里，**没有闭环可见的商家水印能力**；
4. 同时分享配置页也**没有入口**，导致这项权益无法被配置、无法被解释、无法验收。

因此本期应解决的核心不是“造一个复杂水印系统”，而是：

> 把现有零散的半成品收敛成一个用户可见、可配置、可验收、且真正与 PRO 权益绑定的“商家水印功能”。

---

## 5. 设计目标（建议）

### 5.1 目标

建议把本期目标定义为：

1. **补齐 PRO 水印权益闭环**，让“图片水印能力”从营销文案变成真实能力。
2. **优先覆盖已存在的生成型图片链路**，而不是去改原始图库或公开资源动态变体。
3. **优先做轻配置、低风险、可回滚方案**，避免演变成复杂海报编辑器或图片加工平台。
4. **保证历史资产稳定**，不对历史证书/夫妻图做追溯性重渲染。

### 5.2 非目标

本期不建议纳入：

1. 对所有原始产品图自动加水印。
2. 对公开页在线浏览图（`/shares/:id/public/assets`）动态加水印。
3. 可视化拖拽编辑水印位置、旋转角度、平铺密度等高级编辑能力。
4. 海报模板编辑器 / 图文排版器。

---

## 6. 建议的产品口径

### 6.1 对外口径（建议）

建议统一使用“**商家水印**”而不是“防盗水印”或“图片加密”，与仓库现有文案保持一致。

建议口径：

- **专业版（PRO）可在分享海报、夫妻图、证书图中展示商家水印。**
- 默认使用店铺/租户名称生成水印文案。
- 历史已生成资产保持不变，新生成内容按最新配置生效。

### 6.2 套餐权益口径（建议）

#### FREE
- 无水印配置入口。
- 分享、海报、证书、夫妻图保持现状。

#### BASIC
- 与 FREE 保持一致，不开放水印配置。
- 不建议本期把 BASIC 做成“只可看不可配”，避免复杂心智。

#### PRO
- 开放“商家水印”配置能力。
- 对以下**新生成**资产生效：
  1. 分享海报
  2. 夫妻图
  3. 证书图

### 6.3 为什么不建议“非 Pro 强制平台水印”

当前仓库没有现成平台水印链路，也没有足够证据表明当前产品方向是“非 Pro 强制加平台水印”。

为了避免引发：
- 既有分享图体验退化；
- BASIC 用户负反馈；
- 对外素材突变；

建议本期先把水印定义为 **PRO 的增值能力**，而不是**非 Pro 的惩罚能力**。

---

## 7. 版本范围建议

### 7.1 Phase 1（建议本期）

仅覆盖三条“生成型”导出链路：

1. **分享海报**
   - 前端 Canvas 生成
   - 下载即导出
2. **夫妻图**
   - 服务端生成 PNG
   - 用户长按保存/转发
3. **证书图**
   - 服务端生成 PNG
   - 验真页可查看

### 7.2 Phase 2（后续）

可选扩展：

1. 公共详情页在线图片动态水印
2. 原始图库导出加水印
3. 水印模板、平铺、旋转、角标、多语言
4. 团队级品牌素材（Logo + 文案组合）

---

## 8. 页面入口设计（建议）

### 8.1 主入口：分享配置页

建议把主配置入口放在：

- `/app/[tenantSlug]/share-presentation`

原因：

1. 当前它已经是“对外展示能力”的设置页；
2. 已有品牌色、标题、封面、微信二维码配置；
3. 水印与“品牌化展示”心智一致；
4. 改这里比新增一个独立一级页面更低成本。

建议新增一个区块：

- 卡片标题：`商家水印`
- 说明：`专业版可在分享海报、夫妻图、证书图中展示商家水印。`
- 状态：
  - FREE/BASIC：展示升级引导
  - PRO：展示配置表单

### 8.2 次入口：订阅页

在 `/app/[tenantSlug]/subscription`：

- 保留 PRO 套餐“图片水印能力”卖点；
- 增加跳转 CTA：`去配置商家水印`；
- 非 PRO 点击时进入升级流程或跳到分享配置页的付费提示区域。

### 8.3 资产生成流程中的提示入口

建议在以下位置增加“只读状态展示”，不做复杂编辑：

- 分享弹窗：显示“当前海报将带商家水印 / 未启用”
- 证书 Studio：`商家水印` badge 显示当前状态
- 夫妻图预览弹窗：显示“已带商家水印”或“未启用”

这样可形成：

- 配置在一个地方；
- 使用时在多个地方确认；
- 不把用户带入新的复杂编辑器。

---

## 9. 交互流程设计（建议）

### 9.1 非 PRO 用户

1. 进入分享配置页。
2. 看到“商家水印”卡片。
3. 卡片显示：
   - 功能说明
   - `专业版可用`
   - 升级按钮
4. 点击升级，跳转订阅页或直接打开购买弹窗。

### 9.2 PRO 用户首次使用

1. 进入分享配置页。
2. 默认展示：
   - 开关：`启用商家水印`
   - 默认文案预览：`{tenantName} · 珍藏证书`
   - 生效范围说明：`分享海报 / 夫妻图 / 证书图`
3. 用户保存后立即生效于**新生成**资产。

### 9.3 PRO 用户生成分享海报

1. 打开分享弹窗。
2. 展示当前海报预览。
3. 预览中出现水印。
4. 下载海报时导出带水印 PNG。

### 9.4 PRO 用户生成夫妻图 / 证书

1. 在原有生成流程中保持原按钮与步骤不变。
2. 生成时读取当前水印配置。
3. 生成结果图带上水印。
4. 同时写入 `watermarkSnapshot`，供后续验真/详情页展示。

### 9.5 历史资产

- 不追溯重刷。
- 已有证书/夫妻图继续展示历史文件。
- 其 `watermarkSnapshot` 若为空，则按“历史未记录”处理。

---

## 10. 配置项设计（建议）

### 10.1 Phase 1 最小配置

建议只做以下字段：

1. `enabled: boolean`
   - 是否启用商家水印
2. `textMode: 'AUTO_TENANT_NAME' | 'CUSTOM'`
   - 自动租户名 / 自定义文案
3. `customText: string | null`
   - 自定义文案，建议上限 24~32 个字符
4. `applyToSharePoster: boolean`
5. `applyToCouplePhoto: boolean`
6. `applyToCertificate: boolean`

### 10.2 默认值建议

- `enabled = true`（仅对 PRO 首次开通生效时建议）
- `textMode = AUTO_TENANT_NAME`
- `customText = null`
- `applyToSharePoster = true`
- `applyToCouplePhoto = true`
- `applyToCertificate = true`

### 10.3 暂不建议本期开放的高级项

- 透明度
- 平铺密度
- 角度
- 字体
- 位置拖拽
- Logo 图片上传

原因：

1. 前后端链路不一致（Canvas / SVG / sharp）。
2. 高级布局配置会显著增加测试矩阵。
3. 当前仓库还没有专门的图片样式系统承载这类能力。

---

## 11. 数据模型设计（建议）

### 11.1 推荐：新增独立配置表

建议新增：`tenant_watermark_configs`

字段建议：

- `id`
- `tenant_id`（unique）
- `enabled`
- `text_mode` (`AUTO_TENANT_NAME` / `CUSTOM`)
- `custom_text`
- `apply_to_share_poster`
- `apply_to_couple_photo`
- `apply_to_certificate`
- `created_at`
- `updated_at`

### 11.2 不建议复用 `TenantSharePresentationConfig` 的原因

虽然入口页会放在分享配置页，但水印并不只影响分享：

- 它还影响证书
- 还影响夫妻图
- 后续还可能影响其他导出图

因此从领域边界上，**水印配置是“导出资产配置”而不是“公开分享页配置”**，独立表更干净。

### 11.3 保留现有 `watermarkSnapshot`

现有：

- `ProductCertificate.watermarkSnapshot`
- `ProductCouplePhoto.watermarkSnapshot`

建议继续保留，并扩充结构（若需要）：

```json
{
  "platformTemplate": "merchant.only",
  "tenantName": "XX 龟舍",
  "watermarkText": "XX 龟舍 · 珍藏证书",
  "enabled": true,
  "textMode": "AUTO_TENANT_NAME"
}
```

说明：

- 快照用于锁定“当时生成时的文案”，避免后续配置变化影响历史记录解释。
- 历史记录兼容旧结构即可，不强制回填。

### 11.4 分享海报是否需要落库快照？

本期建议：**不新增分享海报落库模型**。

原因：

- 当前分享海报是前端即时生成并下载；
- 没有现成的“share poster asset” 表；
- 为了水印单独加一套落库/回收/存储逻辑，投入过大。

建议策略：

- 分享海报按**当前生效配置**即时渲染；
- 证书 / 夫妻图继续按**生成时快照**管理。

---

## 12. 接口设计（建议）

### 12.1 推荐新增接口

#### `GET /tenant-watermark`
返回：

```json
{
  "entitlement": {
    "plan": "PRO",
    "canEdit": true,
    "reason": null
  },
  "config": {
    "enabled": true,
    "textMode": "AUTO_TENANT_NAME",
    "customText": null,
    "applyToSharePoster": true,
    "applyToCouplePhoto": true,
    "applyToCertificate": true
  },
  "effective": {
    "enabled": true,
    "watermarkText": "XX 龟舍 · 珍藏证书"
  }
}
```

#### `PUT /tenant-watermark`
- 仅 PRO 可写。
- BASIC / FREE 返回 403，并带明确错误码，例如：`SUBSCRIPTION_FEATURE_NOT_AVAILABLE`。

### 12.2 生成链路读取方式

#### 分享海报
- 前端打开分享弹窗时，额外请求一次 `/tenant-watermark`；
- 或在分享配置页预取并缓存。

#### 证书 / 夫妻图
- 服务端生成前读取 `tenant_watermark_configs`；
- 计算 effective watermark；
- 渲染并写入 `watermarkSnapshot`。

### 12.3 现有接口建议保持兼容

以下接口本期不建议破坏性改动：

- `/tenant-share-presentation`
- `/shares`
- `/products/:id/certificates/*`
- `/products/:id/couple-photo/*`（若存在）

只需在内部生成流程里增加对 watermark config 的读取与生效逻辑。

---

## 13. 渲染策略设计（建议）

### 13.1 Phase 1 统一原则

建议采用：**固定位置、弱侵入、可识别的商家水印**。

即：

- 不做满屏平铺；
- 不遮挡主体信息；
- 不引入复杂样式编辑；
- 保证三条链路视觉风格尽量一致。

### 13.2 分享海报

建议位置：

- 海报底部信息区，位于 `footerLabel` 上方或同区域内。

建议样式：

- 小字号
- 半透明
- 中性灰 / 品牌色低透明度

原因：

- 当前海报是前端 Canvas，底部区域最稳定；
- 不会因图片裁切、跨域图片、不同海报图数量而破版。

### 13.3 夫妻图

建议位置：

- 底部中间，靠近 `generatedAtLabel` 附近，但不覆盖二维码与价格。

原因：

- 夫妻图版式稳定；
- 当前底部区域已有价格、时间、二维码，插入一行轻水印风险较低。

### 13.4 证书图

建议位置：

- 证书底部 footer 区域，和 `Verify ID` 同一视觉层级；
- 与现有 `verificationStatementZh` 做上下排布，而不是替换验真信息。

原因：

- 当前证书 footer 已存在固定文案与验真号；
- 在这个区域加水印，比覆盖主体图和血统信息更稳。

### 13.5 为什么不建议本期做满屏平铺水印

- 证书 / 夫妻图 / 分享海报是三套不同实现；
- 平铺会带来：
  - 文字截断
  - 不同分辨率一致性差
  - 性能与调试复杂度上升
- 当前仓库没有统一的图片模板引擎来消化这些差异。

---

## 14. 权限与兼容策略（建议）

### 14.1 权限判定

建议新增统一能力判定：

- `canUseMerchantWatermark(plan, status)`

规则建议：

- `plan === PRO && status === ACTIVE` => true
- 其他 => false

### 14.2 降级策略

当租户从 PRO 降级后：

- 已存量证书 / 夫妻图：保持不变；
- 分享海报：因是即时生成，后续重新打开分享弹窗时按当前权益判断；
- 水印配置保留，但变成只读，不删除。

### 14.3 历史数据兼容

- `watermarkSnapshot = null` 的旧记录继续兼容；
- 验真页若存在 snapshot，可显示真实文案；
- 若无 snapshot，则显示“未记录 / 历史版本未保存”。

### 14.4 UI 兼容

- 分享配置页新增卡片即可，不破坏现有表单结构；
- 分享弹窗只增加状态提示与渲染，不改变原流程；
- 证书 / 夫妻图生成按钮与步骤不调整。

---

## 15. 风险点

### 15.1 产品口径风险

当前 PRO 已宣传“图片水印能力”，但功能未闭环。

风险：
- 用户理解为“已经有”；
- 实际却不能配置或看不到效果。

建议：
- 尽快统一描述为“商家水印（支持分享海报/夫妻图/证书图）”。

### 15.2 技术债风险：字段已在、渲染没用

当前 `watermarkText` / `watermarkSnapshot` 已存在。

风险：
- 后续开发者容易误以为功能已经完整；
- 继续堆功能会造成更多“假完成”。

建议：
- 本期优先把证书 / 夫妻图模板真正画出来。

### 15.3 `maxShares` 语义混乱

当前字段名和 UI 文案容易让人以为是“分享次数额度”，但管理端已说明它不是。

风险：
- 后续如果把“水印能力”也混进 `maxShares` 或 share entitlement，容易继续扩大混乱。

建议：
- 水印能力单独建 entitlement，不复用 `maxShares`。

### 15.4 分享海报是前端即时生成

风险：
- 不同浏览器字体与 Canvas 表现略有差异；
- 若以后想追溯“当时导出的海报是什么样”，没有服务端留档。

建议：
- Phase 1 接受“分享海报按当前配置即时渲染”；
- 不在本期扩展海报落库系统。

### 15.5 验真页展示与真实数据不一致

当前验真页显示的是固定说明“仅商家水印”，不是 snapshot 实际值。

风险：
- 用户以为证书一定有水印；
- 实际老数据或未启用时不一定如此。

建议：
- 后续把验真页的该信息改为读取 `watermarkSnapshot`。

---

## 16. 验收标准（建议）

### 16.1 配置能力

1. PRO 用户可在分享配置页看到“商家水印”配置区。
2. FREE / BASIC 用户只能看到说明与升级入口，不能保存配置。
3. PRO 用户可保存开关与文案模式。

### 16.2 分享海报

1. PRO + 启用水印时，分享海报预览出现商家水印。
2. 下载的 PNG 与预览一致。
3. FREE / BASIC 或 PRO 关闭水印时，不出现商家水印。

### 16.3 夫妻图

1. PRO + 启用水印时，新生成夫妻图可见商家水印。
2. 生成记录落库时保存 `watermarkSnapshot`。
3. 历史夫妻图不被追溯修改。

### 16.4 证书图

1. PRO + 启用水印时，新生成证书图可见商家水印。
2. 证书记录落库时保存 `watermarkSnapshot`。
3. 验真接口返回真实 snapshot。

### 16.5 兼容性

1. 老数据仍能正常打开、查看、验真。
2. 降级后，历史资产不受影响；新生成行为按当前套餐判断。
3. 不影响现有分享链接、二维码、公开页浏览与分享归因链路。

---

## 17. 推荐实施顺序（建议）

### Step 1：补产品定义与接口契约

- 定义 entitlement
- 定义 watermark config schema
- 新增 `/tenant-watermark` GET/PUT

### Step 2：补分享配置页入口

- 增加“商家水印”卡片
- 非 PRO 展示升级引导
- PRO 展示轻配置表单

### Step 3：补证书 / 夫妻图真实绘制

- 在 `certificate-style.ts` 真实输出 `watermarkText`
- 在 `couple-photo-style.ts` 真实输出 `watermarkText`
- 不改变现有生成流程结构

### Step 4：补分享海报绘制

- 在 `share-poster.ts` 加入统一底部水印绘制
- 分享弹窗读取 effective watermark

### Step 5：补验真/详情只读显示

- 验真页从固定文案切为 snapshot 驱动
- 夫妻图/证书预览显示当前是否带水印

---

## 18. 我对当前阶段的建议

### 建议做

1. 先确认产品口径：**Pro 的商家水印能力，先覆盖分享海报 / 夫妻图 / 证书图。**
2. 先补配置入口与服务端/前端统一渲染文案。
3. 优先把仓库里已有的 `watermarkText` / `watermarkSnapshot` 半成品闭环。

### 暂不建议做

1. 改公开页在线图片链路。
2. 改原始产品图库。
3. 上高级海报编辑器。
4. 用 `maxShares` 或其他旧字段硬复用水印能力开关。

---

## 19. 本次产出

本次已完成：

- 仓库现状调研
- 证据梳理
- Pro 会员水印功能详细设计方案
- 仓库内 Markdown 沉淀

本次**未执行业务代码改动**，因为当前阶段更适合先定口径、定边界、定模型，避免在半成品状态上继续累积实现偏差。
