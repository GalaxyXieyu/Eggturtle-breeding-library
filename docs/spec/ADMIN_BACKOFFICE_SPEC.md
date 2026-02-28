# 平台后台业务规格（超级管理员）

状态：当前生效基线
更新日期：2026-02-28

## 1. 业务边界

平台后台用于跨租户的平台运营管理，与租户业务端严格隔离：

- 租户端：`apps/web`，路由 `/app/[tenantSlug]/...`
- 公开页：`apps/web`，路由 `/public/...`
- 平台后台：`apps/admin`，路由 `/dashboard/...`
- `apps/web/app/admin` 已废弃，仅保留跳转能力

## 2. 访问控制（强约束）

- 平台后台默认关闭。
- 开启平台后台访问必须同时满足：
  - `SUPER_ADMIN_ENABLED=true`
  - 请求邮箱在 `SUPER_ADMIN_EMAILS` 白名单
- 跨租户后台 API 统一在 `/admin/...`。
- 所有 `/admin` 请求仍需常规登录鉴权。
- 关键后台操作必须写审计日志，至少包含：`actorUserId`、`targetTenantId`。
- 仓库与文档中不得保存密钥（例如对象存储密钥、第三方 API Key）。

## 3. 路由与运行约定

- 后台 UI：
  - 应用：`apps/admin`
  - 路由基线：`/dashboard/*`
  - 本地端口：`30020`
- 后台 API：
  - 应用：`apps/api`
  - 路由基线：`/admin/*`

## 4. 当前最小功能范围

1. 租户管理
- 查询租户列表
- 创建租户（`slug`、`name`）

2. 用户管理
- 查询用户列表

3. 会员关系管理
- 按 `(tenantId, userEmail, role)` 授予或更新租户成员角色

4. 审计日志
- 查询审计日志
- 按 `tenantId` 过滤

## 5. 工程边界约束

- 后台 UI 代码放在 `apps/admin/app/...` 与 `apps/admin/lib/...`。
- 可复用公共能力放在 `packages/shared` 或 `apps/admin` 内。
- 禁止将后台 UI 组件反向引入 `apps/web`。

## 6. 关联规格

- `docs/spec/SAAS_SPEC.md`
- `docs/spec/RBAC_SPEC.md`
