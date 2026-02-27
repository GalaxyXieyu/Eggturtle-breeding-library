# T23 账号矩阵与权限验收口径

状态：active
更新：2026-02-27

## 1. 目标与范围

本文定义租户侧角色矩阵（`OWNER / ADMIN / EDITOR / VIEWER`）与 `super-admin` 的验收口径，覆盖：

- products（含图片内容访问）
- featured-products
- shares（创建与公开读取）
- `/admin/*` 后台接口

说明：

- 租户侧权限基于 `AuthGuard + RbacGuard`，并按 `@RequireTenantRole(...)` 做最小角色校验。
- `super-admin` 仅用于 `/admin/*` 跨租户后台接口，不替代租户成员身份。
- 本文中的“写”接口默认按业务数据变更定义（创建/更新/删除/重排/上传）。

## 2. 角色定义

- `OWNER`：租户最高权限。
- `ADMIN`：租户管理权限（不含 owner 独占概念）。
- `EDITOR`：可读写业务数据。
- `VIEWER`：只读。
- `super-admin`：独立后台身份（需满足 `SUPER_ADMIN_ENABLED=true` 且邮箱在 `SUPER_ADMIN_EMAILS`），用于 `/admin/*`。

## 3. 接口权限矩阵（验收基准）

### 3.1 租户业务接口

| 资源 | 接口 | 最小角色 | OWNER | ADMIN | EDITOR | VIEWER |
|---|---|---|---|---|---|---|
| products 读 | `GET /products` | `VIEWER` | ✅ | ✅ | ✅ | ✅ |
| products 写 | `POST /products` | `EDITOR` | ✅ | ✅ | ✅ | ❌ |
| images 读 | `GET /products/:pid/images/:iid/content` | `VIEWER` | ✅ | ✅ | ✅ | ✅ |
| images 写 | `POST /products/:id/images` / `DELETE /products/:pid/images/:iid` / `PUT /products/:pid/images/:iid/main` / `PUT /products/:pid/images/reorder` | `EDITOR` | ✅ | ✅ | ✅ | ❌ |
| featured-products 读 | `GET /featured-products` | `VIEWER` | ✅ | ✅ | ✅ | ✅ |
| featured-products 写 | `POST /featured-products` / `DELETE /featured-products/:id` / `PUT /featured-products/reorder` | `EDITOR` | ✅ | ✅ | ✅ | ❌ |
| shares 写 | `POST /shares` | `EDITOR` | ✅ | ✅ | ✅ | ❌ |
| shares 公开读 | `GET /s/:shareToken` / `GET /shares/:shareId/public?...` | Public | ✅ | ✅ | ✅ | ✅ |

### 3.2 后台接口（super-admin）

| 资源 | 接口 | 普通租户角色（OWNER/ADMIN/EDITOR/VIEWER） | super-admin |
|---|---|---|---|
| admin 读写 | `/admin/*` | ❌（403） | ✅（200/201，受具体接口语义影响） |

## 4. 状态码与 errorCode 验收口径

### 4.1 通用鉴权与租户校验

- 未登录（缺失/无效 token）
  - `401` + `errorCode=UNAUTHORIZED`
- 已登录但 token 未选择租户（命中租户接口时）
  - `400` + `errorCode=TENANT_NOT_SELECTED`
- 已登录且带租户，但非该租户成员
  - `403` + `errorCode=NOT_TENANT_MEMBER`
- 已登录且为租户成员，但角色不足
  - `403` + `errorCode=FORBIDDEN`

### 4.2 本文覆盖接口的关键断言

- `POST /products`（VIEWER）→ `403 FORBIDDEN`
- `POST /featured-products`（VIEWER）→ `403 FORBIDDEN`
- `POST /shares`（VIEWER）→ `403 FORBIDDEN`
- `GET /products/:pid/images/:iid/content`（任一租户角色）
  - 本地存储：`200`
  - 非本地存储（签名跳转）：`302`
- `GET /admin/tenants`（普通租户角色）→ `403 FORBIDDEN`
- `GET /admin/tenants`（super-admin）→ `200`

## 5. 验收用例清单（最小集合）

以同一租户下 4 个账号（OWNER/ADMIN/EDITOR/VIEWER）执行：

1. products
- 四角色 `GET /products` 均为 `200`
- OWNER/ADMIN/EDITOR 执行 `POST /products` 为 `201`
- VIEWER 执行 `POST /products` 为 `403 FORBIDDEN`

2. featured-products
- 四角色 `GET /featured-products` 均为 `200`
- OWNER/ADMIN/EDITOR 执行 `POST /featured-products` 为 `201`
- VIEWER 执行 `POST /featured-products` 为 `403 FORBIDDEN`

3. shares
- OWNER/ADMIN/EDITOR 执行 `POST /shares` 为 `201`
- VIEWER 执行 `POST /shares` 为 `403 FORBIDDEN`
- 任意匿名访问 `GET /s/:shareToken` 为 `302`
- 使用签名参数访问 `GET /shares/:shareId/public?...` 为 `200`

4. images access endpoint
- 先由可写角色上传图片（`POST /products/:id/images` → `201`）
- 四角色访问 `GET /products/:pid/images/:iid/content` 为 `200`（local）或 `302`（remote storage）

5. admin endpoints
- OWNER/ADMIN/EDITOR/VIEWER 访问 `GET /admin/tenants` 均为 `403 FORBIDDEN`
- super-admin 访问 `GET /admin/tenants` 为 `200`

## 6. 本地自动化验证脚本

脚本：`scripts/smoke/account_matrix_smoke.sh`

- 默认安全：仅输出执行计划，不发起请求。
- 需要显式 `--confirm-writes` 才会执行（包含写操作）。
- 默认拒绝非 localhost API，远端需 `--allow-remote`。
- 可选 `--provision`：通过 super-admin 自动建租户并分配 OWNER/ADMIN/EDITOR/VIEWER 会员角色。

参考命令：

```bash
scripts/smoke/account_matrix_smoke.sh \
  --confirm-writes \
  --owner-email owner@example.com \
  --admin-email admin@example.com \
  --editor-email editor@example.com \
  --viewer-email viewer@example.com \
  --tenant-id <existing-tenant-id>
```

或（自动建租户+授权）：

```bash
scripts/smoke/account_matrix_smoke.sh \
  --confirm-writes \
  --provision \
  --super-admin-email super@example.com \
  --owner-email owner@example.com \
  --admin-email admin@example.com \
  --editor-email editor@example.com \
  --viewer-email viewer@example.com
```
