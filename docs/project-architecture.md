# Project Architecture（租户后台 vs 平台管理后台）

更新时间：2026-03-03（V4：分享端获客闭环 + 后台导航收敛）  
范围：`apps/web`、`apps/admin`、`apps/api`、`packages/shared`

## 1. 平台边界（必须严格隔离）

| 平台域 | 主要职责 | 代码入口 | 边界约束 |
|---|---|---|---|
| 租户后台（Tenant Workspace） | 租户内业务操作：产品/种龟、系列、公开分享、账号设置 | `apps/web/app/app/[tenantSlug]/*` | 只处理“当前租户”上下文，不做跨租户运维 |
| 公开分享端（Public Share Surface） | 对外只读展示与转化入口（系列/宠物/我的） | `apps/web/app/public/s/[shareToken]/*` | 默认只读；不允许新增/编辑/删除写操作 |
| 平台管理后台（Platform Admin） | 跨租户治理：租户管理、成员管理、订阅与平台审计 | `apps/admin/app/dashboard/*` | 只服务超级管理员，不承载租户业务页面 |
| API（统一业务后端） | 提供租户域和平台域 API；执行鉴权、RBAC、审计、订阅守卫 | `apps/api/src/*` | `/admin/*` 与普通租户 API 严格分域 |

关键证据：
- `apps/web/app/admin/page.tsx` 已将旧后台入口跳转到 `apps/admin`。
- `apps/api/src/admin/admin.controller.ts` 使用 `AuthGuard + SuperAdminGuard + RequireSuperAdmin` 保护平台端接口。
- `apps/admin/components/dashboard/nav-config.ts` 已包含平台级治理与分析导航：`总览/租户/成员/审计/分析/用量/计费`。

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

### 2.3 分享端转化链路（V4）

1. 访客进入 `/public/s/[shareToken]`，默认可浏览宠物与系列，不强制登录。
2. 访客主动进入 `/public/s/[shareToken]/me` 才触发注册/登录 CTA。
3. 登录成功后回流 `/app?intent=dashboard&source=share`；若 `next` 非法则回退 `/app?intent=dashboard`。

关键证据：
- `apps/web/app/public/s/[shareToken]/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/app/page.tsx`

## 3. 当前架构能力图（简版）

```text
apps/web (租户后台)
  -> /auth/*, /tenants/*, /products/*, /shares/*, /me/*
  -> /public/s/:shareToken/*

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
- 分享端必须保持只读浏览模型，不可直接触发租户写接口。
- 跨租户统计（活跃度、付费看板、平台级告警）必须定义为 `/admin/*` 接口。
- 平台端写操作必须记录 `super_admin_audit_logs`。
- `apps/web/app/admin/page.tsx` 仅保留迁移跳转职责，不再扩展管理功能。

### SHOULD

- 新增请求/响应 schema 统一放在 `packages/shared`，避免双端口径分叉。
- 新增平台模块优先按领域分目录（`analytics`、`billing`、`governance`、`security`）。
- 平台端与租户端 UI 组件不互相依赖，避免边界污染。

## 5. 下一阶段架构补齐方向（平台端）

建议在 `apps/api/src/admin` 下继续补齐领域模块（Phase 2+）：

- `analytics`：补齐留存分层、可钻取明细与口径版本化。
- `billing`：补齐支付回调入账、对账、退款与催缴状态。
- `governance`：补齐工单化审批与批量治理编排。
- `security`：补齐平台会话治理、风控审计导出与二次验证。

对应前端建议目录：

- `apps/admin/app/dashboard/analytics/*`
- `apps/admin/app/dashboard/billing/*`
- `apps/admin/app/dashboard/governance/*`
- `apps/admin/app/dashboard/security/*`

## 6. V4 信息架构冻结（Web 租户端）

移动端主导航收敛为 4 个一级入口：

1. 看板：`/app/[tenantSlug]`
2. 系列：`/app/[tenantSlug]/series`
3. 宠物：`/app/[tenantSlug]/products`
4. 我的：`/app/[tenantSlug]/account`

订阅与分享配置不再占用一级导航，统一并入“我的”页作为入口卡片跳转：

- 订阅：`/app/[tenantSlug]/subscription`
- 分享配置：`/app/[tenantSlug]/share-presentation`
