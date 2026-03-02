# Project Architecture（租户后台 vs 平台管理后台）

更新时间：2026-03-02  
范围：`apps/web`、`apps/admin`、`apps/api`、`packages/shared`

## 1. 平台边界（必须严格隔离）

| 平台域 | 主要职责 | 代码入口 | 边界约束 |
|---|---|---|---|
| 租户后台（Tenant Workspace） | 租户内业务操作：产品/种龟、系列、公开分享、账号设置 | `apps/web/app/app/[tenantSlug]/*` | 只处理“当前租户”上下文，不做跨租户运维 |
| 平台管理后台（Platform Admin） | 跨租户治理：租户管理、成员管理、订阅与平台审计 | `apps/admin/app/dashboard/*` | 只服务超级管理员，不承载租户业务页面 |
| API（统一业务后端） | 提供租户域和平台域 API；执行鉴权、RBAC、审计、订阅守卫 | `apps/api/src/*` | `/admin/*` 与普通租户 API 严格分域 |

关键证据：
- `apps/web/app/admin/page.tsx` 已将旧后台入口跳转到 `apps/admin`。
- `apps/api/src/admin/admin.controller.ts` 使用 `AuthGuard + SuperAdminGuard + RequireSuperAdmin` 保护平台端接口。
- `apps/admin/components/dashboard/nav-config.ts` 当前仅包含平台级导航：`总览/租户/成员/审计日志`。

## 2. 运行链路（请求视角）

### 2.1 租户后台链路

1. `apps/web` 页面发起请求（如 `/products`、`/shares`、`/tenants/current`）。
2. `apps/api` 通过访问令牌解析 `tenantId`，执行租户内权限校验。
3. 写操作受订阅写保护与配额保护。

关键证据：
- `apps/api/src/tenants/tenants.controller.ts`
- `apps/api/src/products/products.controller.ts`
- `apps/api/src/auth/tenant-subscription.guard.ts`

### 2.2 平台管理后台链路

1. `apps/admin` 页面调用 `/admin/*` 接口。
2. `apps/api` 仅允许 super admin 调用跨租户能力。
3. 操作记录进入 `super_admin_audit_logs`。

关键证据：
- `apps/admin/app/dashboard/page.tsx`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/super-admin-audit-logs.service.ts`

## 3. 当前架构能力图（简版）

```text
apps/web (租户后台)
  -> /auth/*, /tenants/*, /products/*, /shares/*, /me/*

apps/admin (平台管理后台)
  -> /admin/tenants*
  -> /admin/tenants/:tenantId/subscription*
  -> /admin/tenants/:tenantId/members*
  -> /admin/audit-logs
  -> /admin/users

apps/api (统一后端)
  -> 租户域 Controller + 平台域 Controller + 守卫与审计服务
```

## 4. 代码要求（MUST / SHOULD）

### MUST

- 平台管理能力必须落在 `apps/admin`，并通过 `apps/api/src/admin/*` 暴露。
- 租户业务能力必须落在 `apps/web`，禁止在 `apps/admin` 实现租户业务页面。
- 跨租户统计（活跃度、付费看板、平台级告警）必须定义为 `/admin/*` 接口。
- 平台端写操作必须记录 `super_admin_audit_logs`。
- `apps/web/app/admin/page.tsx` 仅保留迁移跳转职责，不再扩展管理功能。

### SHOULD

- 新增请求/响应 schema 统一放在 `packages/shared`，避免双端口径分叉。
- 新增平台模块优先按领域分目录（`analytics`、`billing`、`governance`、`security`）。
- 平台端与租户端 UI 组件不互相依赖，避免边界污染。

## 5. 下一阶段架构补齐方向（平台端）

建议在 `apps/api/src/admin` 下新增领域模块：

- `analytics`：活跃度与收入指标聚合。
- `billing`：支付回调入账、对账、退款与催缴状态。
- `governance`：租户生命周期（冻结/恢复/下线）编排。
- `security`：平台会话治理、风控审计导出。

对应前端建议目录：

- `apps/admin/app/dashboard/analytics/*`
- `apps/admin/app/dashboard/billing/*`
- `apps/admin/app/dashboard/governance/*`
- `apps/admin/app/dashboard/security/*`
