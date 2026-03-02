# T60 审计日志导出（CSV）API + 接口测试证据（2026-03-02）

## 任务范围
- 任务：`T60` 审计日志导出（CSV）
- 范围：后端 API + `scripts/api-tests/admin.ts` 覆盖导出契约与止损逻辑

## 接口契约
- 路径：`GET /admin/audit-logs/export`
- 权限：沿用 `/admin/*` 超级管理员白名单权限（`JwtAuthGuard + SuperAdminGuard`）
- 查询参数（复用 audit-logs 过滤）
  - `tenantId?`
  - `actorUserId?`
  - `action?`
  - `from`（必传，ISO datetime）
  - `to`（必传，ISO datetime）
  - `limit?`（默认 `2000`，上限 `5000`）
- 返回：`text/csv; charset=utf-8`，首行为 header
- CSV allowlist 列：`id, createdAt, action, actorUserEmail, actorUserId, targetTenantSlug, targetTenantId`
  - 不导出 `metadata` 等非白名单字段，避免敏感信息外泄

## 止损与错误策略
- 必须传 `from/to`，否则 `400`
- `to < from` 返回 `400`
- 时间跨度上限：31 天；超限返回 `400`
- 匹配数据量若超过 `limit`：返回 `400`，错误信息明确提示缩小时间范围或增加筛选条件

## 变更文件
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/super-admin-audit-logs.service.ts`
- `packages/shared/src/admin.ts`
- `packages/shared/src/index.ts`
- `scripts/api-tests/admin.ts`

## 验证命令
```bash
pnpm --filter @eggturtle/api build

PORT=30113 NODE_ENV=development AUTH_DEV_CODE_ENABLED=true \
SUPER_ADMIN_ENABLED=true SUPER_ADMIN_EMAILS=synthetic.superadmin@local.test \
pnpm --filter @eggturtle/api dev

NODE_ENV=development AUTH_DEV_CODE_ENABLED=true \
pnpm api-tests -- --confirm-writes --clear-token-cache --json \
  --api-base http://localhost:30113 --allow-remote --only admin \
  --super-admin-email synthetic.superadmin@local.test --require-super-admin-pass
```

## 关键输出摘要
- `@eggturtle/api build`：通过（`tsc -p tsconfig.build.json` 无错误）
- `api-tests(admin)`：通过
  - `event=admin.done checks=19 superAdminStatus=200`
  - `event=runner.done modules=1 totalChecks=19`
- JSONL 证据：`docs/plan/evidence/t60-api-tests-admin-20260302.jsonl`

## PR
- PR：待创建（补充链接）

## 备注
- PR 合并后，请回填 SSOT：`docs/plan/EggsTask.csv` 的 T60 Evidence 字段。
