# business-flows

## 主线 A：多租户访问控制

- 登录：`/auth/password-login` 或验证码流程
- 绑定租户：`/auth/switch-tenant`
- 带 tenant 访问业务 API（products/series/breeders/...）

状态流：

`anonymous -> authenticated(no-tenant) -> authenticated(with-tenant) -> tenant-scoped operations`

锚点：`apps/api/src/auth/auth.controller.ts:40`, `apps/api/src/auth/auth.controller.ts:48`, `apps/api/src/products/products.controller.ts:181`。

## 主线 B：产品与图片管理

- 创建产品：`POST /products`
- 图片上传：`POST /products/:id/images`
- 主图设置：`PUT /products/:pid/images/:iid/main`
- 排序：`PUT /products/:pid/images/reorder`
- 删除：`DELETE /products/:pid/images/:iid`

状态流：

`product_created -> image_uploaded -> main_image_selected -> image_ordered -> image_deleted(optional)`

锚点：`apps/api/src/products/products.controller.ts:60`, `apps/api/src/products/products.controller.ts:88`, `apps/api/src/products/products.controller.ts:152`, `apps/api/src/products/products.controller.ts:166`, `apps/api/src/products/products.controller.ts:138`。

## 主线 C：分享链路

- 创建分享：`POST /shares`
- 入口跳转：`GET /s/:shareToken`
- 公共读取：`GET /shares/:shareId/public`

状态流：

`resource_exists -> share_created -> entry_opened -> public_payload_resolved`

锚点：`apps/api/src/shares/shares.controller.ts:42`, `apps/api/src/shares/shares.controller.ts:55`, `apps/api/src/shares/shares.controller.ts:69`。
