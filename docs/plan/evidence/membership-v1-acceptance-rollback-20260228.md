# Membership v1 Acceptance & Rollback Evidence（2026-02-28）

负责人：宇宇
对应任务：T49

## 验收范围
- Membership v1 主链路（subscription guard / plan gate / quota gate）
- 激活码能力（T48）：super-admin 生成 + tenant 兑换

## 执行命令（本地已执行）
```bash
cd /Volumes/DATABASE/code/Eggturtle-breeding-library
pnpm -r lint
pnpm -r build

set -a
source apps/api/.env
set +a
pnpm --filter @eggturtle/api prisma:deploy

PORT=30113 node apps/api/dist/main.js
pnpm api-tests -- --api-base http://localhost:30113 --allow-remote --confirm-writes --only subscription --super-admin-email synthetic.superadmin@local.test --clear-token-cache --require-super-admin-pass
```

## 结果快照
- `subscription` 模块通过：`checks=12`
- 覆盖点包含：
  - admin `GET/PUT /admin/tenants/:tenantId/subscription`
  - admin `POST /admin/subscription-activation-codes`
  - tenant `POST /subscriptions/activation-codes/redeem`
  - 单次兑换限制（重复兑换返回 `SUBSCRIPTION_ACTIVATION_CODE_REDEEM_LIMIT_REACHED`）
  - FREE 计划下 Share 拒绝 + PRO 计划放行
  - 图片数量/存储配额拦截

证据路径（本地）：
- `out/t49-subscription-acceptance/20260228-155551/api-tests-subscription.log`
- `out/t49-subscription-acceptance/20260228-155551/api-30113.log`

## 回滚策略（可执行）
1. 风险止损（无需发版）：
   - `SUPER_ADMIN_ENABLED=false`
   - `SUPER_ADMIN_EMAILS=`（清空）
   - `NEXT_PUBLIC_SUPER_ADMIN_ENABLED=false`
2. 禁用激活码入口：
   - 关闭后台入口（前端按钮/菜单）
   - 或直接 DB 禁用：
     - `UPDATE subscription_activation_codes SET disabled_at = NOW() WHERE disabled_at IS NULL;`
3. 订阅回滚：
   - 使用 admin `PUT /admin/tenants/:tenantId/subscription` 将目标租户切回 `FREE`（并按需清空配额字段）
4. 回归验证：
   - 重跑 `pnpm api-tests -- --only subscription ...`
   - 关键断言：Share 在 FREE 下被拒绝、写入拦截符合预期
