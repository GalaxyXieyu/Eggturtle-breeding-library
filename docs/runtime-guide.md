# runtime-guide

## 适用范围

- in-scope：SaaS 运行与联调入口
- out-of-scope：生产部署参数细节、第三方云平台治理流程

## 运行模式

### SaaS（Nest + Next）

- API 入口：`apps/api/src/main.ts:31`（默认 `30011`）
- 模块装配：`apps/api/src/app.module.ts:17`
- Web/Admin 分别在 `apps/web`、`apps/admin`

## 关键主键口径

- `tenantId` / `tenantSlug` / `userId` / `productId` / `shareId`

## 常见异常与定位起点

- 401/未登录：`apps/web/lib/api-client.ts:137`, `apps/admin/app/api/auth/session/route.ts:13`
- 无 tenant 上下文：`apps/api/src/products/products.controller.ts:181`
