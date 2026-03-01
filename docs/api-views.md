# api-views

## 业务能力 -> API -> 实现

| 能力 | API | 实现 |
|---|---|---|
| 登录认证 | `POST /auth/request-code` `POST /auth/verify-code` `POST /auth/password-login` | `apps/api/src/auth/auth.controller.ts:24` |
| 用户会话信息 | `GET /me` | `apps/api/src/auth/me.controller.ts:10` |
| 租户选择 | `POST /auth/switch-tenant` | `apps/api/src/auth/auth.controller.ts:48` |
| 租户列表/当前租户 | `GET /tenants/me` `GET /tenants/current` | `apps/api/src/tenants/tenants.controller.ts:32` |
| 产品管理 | `GET/POST /products` | `apps/api/src/products/products.controller.ts:71` |
| 产品图片管理 | `POST /products/:id/images` 等 | `apps/api/src/products/products.controller.ts:88` |
| product 关系树（路由名 breeders） | `GET /breeders` `/breeders/:id/events` `/breeders/:id/family-tree` | `apps/api/src/breeders/breeders.controller.ts:27` |
| 分享能力 | `POST /shares` `GET /shares/:shareId/public` | `apps/api/src/shares/shares.controller.ts:42` |
| 平台后台 | `GET/PUT/POST/DELETE /admin/*` | `apps/api/src/admin/admin.controller.ts:32` |

## 参数口径（关键）

- 业务接口默认要求 tenant 上下文（token 中 tenantId）
- 术语统一使用 `product`，`breeders` 仅作为历史路由名保留

锚点：`apps/api/src/products/products.controller.ts:181`, `apps/api/src/breeders/breeders.controller.ts:27`。
