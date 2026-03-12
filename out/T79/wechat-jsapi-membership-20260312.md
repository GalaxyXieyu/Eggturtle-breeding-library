# T79 微信支付 JSAPI 会员订阅接入实现记录

- 日期：2026-03-12
- 执行人：`agent:codex`
- 范围：会员订阅微信 JSAPI 支付一期、微信 OAuth 绑定、订单模型、Webhook 验签与履约、订阅页支付改造、后台月价口径修正。

## 已完成

- 共享层新增订阅价格目录与订单协议：`packages/shared/src/subscription-catalog.ts`、`packages/shared/src/subscription-order.ts`
- 新增错误码与 OAuth schema：`packages/shared/src/error-codes.ts`、`packages/shared/src/auth.ts`
- Prisma 新增：`UserWechatBinding`、`SubscriptionOrder` 及相关枚举：`apps/api/prisma/schema.prisma`
- 新增迁移：`apps/api/prisma/migrations/20260312170000_wechat_jsapi_subscription_orders/migration.sql`
- 后端接入微信 OAuth 与 JSAPI 支付链路：
  - `apps/api/src/auth/wechat-auth.service.ts`
  - `apps/api/src/payments/wechat-pay.service.ts`
  - `apps/api/src/payments/subscription-orders.service.ts`
  - `apps/api/src/payments/subscription-orders.controller.ts`
  - `apps/api/src/payments/subscription-order-scheduler.service.ts`
- Web 订阅页完成微信支付流程改造，并保留激活码入口：`apps/web/app/app/[tenantSlug]/subscription/page.tsx`
- 前端 `ApiError` 透传 `errorCode`，用于识别 `WECHAT_OAUTH_REQUIRED`：`apps/web/lib/api-client.ts`
- Admin Revenue 月价估算改为共享价表：`apps/api/src/admin/admin-analytics.service.ts`

## 关键规则已落地

- 正式价格：
  - `BASIC`: `30=2800`、`90=7900`、`365=29900`
  - `PRO`: `30=4900`、`90=12900`、`365=49900`
- `FREE -> BASIC/PRO`：立即生效
- `BASIC -> BASIC/PRO`：立即履约；升级到 `PRO` 后按当前有效期终点顺延
- `PRO -> PRO`：按当前有效期终点顺延
- `PRO -> BASIC`：支付成功后先记 `PAID + DEFERRED`，到当前 `PRO` 到期后由定时器应用
- 每租户仅允许 1 条已支付未应用的 deferred 降档订单
- 已支付订单应用时统一清空 `disabled* / maxImages / maxStorageBytes / maxShares` 的手工覆盖，恢复标准套餐权益

## 验证结果

- API 构建通过：`pnpm --filter @eggturtle/api build`
- Web 构建通过：`pnpm --filter @eggturtle/web build`
- 订阅回归通过：`pnpm api-tests -- --only subscription --clear-token-cache --confirm-writes --super-admin-email admin@local.test`
- 新增回归覆盖：
  - `/payments/readiness` 包含微信 OAuth / 证书路径检查
  - Provider ready 时，未绑定 OpenID 创建订单返回 `WECHAT_OAUTH_REQUIRED`

## 本地限制 / 说明

- 本地 UI 已完成移动端 WeChat UA smoke，但未实际发起真实微信支付扣款；如需真实支付联调，需要本地也配置可用的微信商户私钥、平台证书与 APIv3 配置。
- 你在聊天里暴露过 `AppSecret`，正式联调前必须先轮换。
