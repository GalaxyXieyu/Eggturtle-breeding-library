# T79 Code Review

- 日期：2026-03-12
- 审查范围：本次微信 JSAPI 订阅支付相关 Git 变更

## 一、审查文件

- `apps/web/app/app/[tenantSlug]/subscription/page.tsx`
- `apps/web/lib/api-client.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/wechat-auth.service.ts`
- `apps/api/src/payments/subscription-orders.service.ts`
- `apps/api/src/payments/wechat-pay.service.ts`
- `apps/api/src/admin/admin-analytics.service.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260312170000_wechat_jsapi_subscription_orders/migration.sql`

## 二、发现与处理

### 文件：`apps/web/app/app/[tenantSlug]/subscription/page.tsx`
- 问题类型：客户端环境判断 / Hydration 一致性
- 改什么：`isWechatBrowser()` 直接在 render 阶段执行，服务端首帧会固定得到 `false`，微信内首屏可能出现 hydration 偏差。
- 怎么改：改为 `useEffect` 后置探测，使用 `boolean | null` 状态，并在 OAuth 回跳恢复流程中等待探测完成后再继续支付。
- 为什么：避免微信内首屏状态与服务端预渲染不一致，防止按钮态与授权恢复逻辑抖动。
- 结论：已在本轮修复。

## 三、优先级

### P0
- 无

### P1
- 无未解决项

### P2
- 可在后续补更细的支付回调 fixture 测试，覆盖签名验签与金额不匹配分支

## 四、验证建议

- `pnpm --filter @eggturtle/api build`
- `pnpm --filter @eggturtle/web build`
- `pnpm api-tests -- --only subscription --clear-token-cache --confirm-writes --super-admin-email admin@local.test`
