# task-detail-views

## 任务 1：产品图片上传链路

- 页面入口：`/app/[tenantSlug]/products/[productId]`
- 前端调用：`apps/web/app/app/[tenantSlug]/products/[productId]/page.tsx:324`
- API：`POST /products/:id/images`
- 后端：`apps/api/src/products/products.controller.ts:88`

风险点：

- 上传字段名固定为 `file`，否则 400。
- 证据：`apps/api/src/products/products.controller.ts:91`, `apps/api/src/products/products.controller.ts:106`

## 任务 2：分享生成与公开访问

- 生成入口：`apps/web/app/app/[tenantSlug]/products/page.tsx:477`
- 公开访问：`apps/web/app/public/share/page.tsx:11` + `apps/web/app/public/_shared/public-share-api.ts:125`
- API：`POST /shares` + `GET /shares/:shareId/public`

风险点：

- 分享鉴权参数（`tenantId/resourceType/resourceId/exp/sig`）必须完整。
- 证据：`apps/web/app/public/_shared/public-share-api.ts:87`

## 任务 3：租户成员管理

- 页面入口：`apps/admin/app/dashboard/memberships/page.tsx:140`
- API：`GET/POST/DELETE /admin/tenants/:tenantId/members`
- 后端：`apps/api/src/admin/admin.controller.ts:105`, `apps/api/src/admin/admin.controller.ts:117`, `apps/api/src/admin/admin.controller.ts:129`

风险点：

- 必须满足 super-admin 白名单与开关约束。
- 证据：`apps/api/src/auth/super-admin.guard.ts:10`
