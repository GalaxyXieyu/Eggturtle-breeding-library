# user-journeys

## JNY-001 登录与租户切换

- 角色：租户用户
- 触发场景：登录后进入租户工作台
- 成功标准：拿到 tenant 上下文 token 并进入 `/app/[tenantSlug]`

### Happy Path

1. `/login` 发起 `POST /auth/password-login` 或验证码登录
- 前端：`apps/web/app/login/page.tsx:301`
- API：`apps/api/src/auth/auth.controller.ts:40`

2. `/tenant-select` 加载并切换租户
- 前端：`apps/web/app/tenant-select/page.tsx:28`, `apps/web/app/tenant-select/page.tsx:87`
- API：`apps/api/src/tenants/tenants.controller.ts:32`, `apps/api/src/auth/auth.controller.ts:48`

3. 跳转 `/app/[tenantSlug]`
- 前端：`apps/web/app/tenant-select/page.tsx:88`
- API：`apps/api/src/auth/me.controller.ts:10`

### Exception Paths

- E1: token 失效，跳转登录：`apps/web/lib/api-client.ts:137`
- E2: 无 tenant，返回 TenantNotSelected：`apps/api/src/series/series.controller.ts:40`

## JNY-002 产品管理与分享

- 角色：租户编辑者
- 触发场景：新建产品并对外分享
- 成功标准：产品可查、分享链接可打开

### Happy Path

1. 列表查询 `GET /products`：`apps/web/app/app/[tenantSlug]/products/page.tsx:260`
2. 创建产品 `POST /products`：`apps/web/app/app/[tenantSlug]/products/page.tsx:443`
3. 创建分享 `POST /shares`：`apps/web/app/app/[tenantSlug]/products/page.tsx:477`
4. 公开访问 `GET /shares/:shareId/public`：`apps/web/app/public/_shared/public-share-api.ts:125`

### Exception Paths

- E1: 权限不足（非 EDITOR）：`apps/api/src/products/products.controller.ts:61`
- E2: 订阅限制：`apps/api/src/products/products.controller.ts:55`

## JNY-003 平台后台管理

- 角色：平台超级管理员
- 触发场景：租户与会员管理、审计查看
- 成功标准：`/dashboard` 页面完成租户/会员管理，审计可查询

### Happy Path

1. 登录后台：`apps/admin/app/login/page.tsx:96`
2. 拉取平台数据：`apps/admin/app/dashboard/page.tsx:35`
3. 管理租户成员：`apps/admin/app/dashboard/memberships/page.tsx:140`
