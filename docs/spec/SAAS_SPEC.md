# 种龟繁殖业务总规格（顶层）

状态：当前生效基线
更新日期：2026-02-28

## 1. 范围与定位

本文是 `docs/spec/` 下的顶层业务规格入口，用于沉淀已在代码中落地或明确生效的业务约束，并指向更细分的子规格文档。

## 2. 已确认且与现状代码一致的规则

1) API 路由不带 `/api` 前缀。
- 示例：`/auth/request-code`、`/products`、`/shares`、`/s/:shareToken`
- 参考：`apps/api/src/main.ts`、`apps/api/src/products/products.controller.ts`、`apps/api/src/shares/shares.controller.ts`

2) 租户端 Web 路由统一为 `/app/[tenantSlug]/...`。
- 参考：`apps/web/app/app/[tenantSlug]/page.tsx`

3) RBAC 为四角色，且默认拒绝。
- 角色：`OWNER | ADMIN | EDITOR | VIEWER`
- 租户成员缺失或角色不足时必须拒绝
- 参考：`packages/shared/src/tenant.ts`、`apps/api/src/auth/rbac.guard.ts`、`apps/api/src/auth/rbac.policy.ts`

4) 公开分享链路为 `shareToken -> 302 签名地址`。
- 稳定入口：`GET /s/:shareToken`
- 公开数据接口必须校验签名与过期时间
- 参考：`apps/api/src/shares/shares.controller.ts`、`apps/api/src/shares/shares.service.ts`、`docs/public-share.md`

5) `Product.code` 必填，且在租户内唯一。
- 请求模型要求 `code` 非空
- 数据库约束：`@@unique([tenantId, code])`
- 参考：`packages/shared/src/product.ts`、`apps/api/prisma/schema.prisma`

6) 平台后台与租户端严格隔离。
- 跨租户后台 API 统一放在 `/admin/...`
- 平台后台 UI 在 `apps/admin`，路由为 `/dashboard/...`
- `apps/web/app/admin` 已废弃，仅保留跳转
- 默认关闭，且需要同时满足：
  - `SUPER_ADMIN_ENABLED=true`
  - 请求邮箱在 `SUPER_ADMIN_EMAILS` 白名单中
- 所有 `/admin` 接口仍需常规鉴权
- 关键后台操作必须写审计日志
- 参考：`apps/api/src/admin/*`、`apps/api/src/auth/super-admin.guard.ts`

## 3. 路由约定

- API（NestJS）：直接资源路径（如 `/products`、`/featured-products`、`/tenants`）
- 超级后台 API：`/admin/...`
- 租户端 Web：`/app/[tenantSlug]/...`
- 平台后台 Web：`/dashboard/...`（由 `apps/admin` 提供）
- 公开页面：
  - 分享入口：`/s/<shareToken>`
  - 公开渲染页：`/public/share?...`

## 4. 跨模块通用规则

- 多租户隔离是强制要求：业务查询与写入必须带租户边界。
- 租户写操作必须做角色校验。
- 关键操作必须可审计。
- 分享访问必须有签名与过期控制。
- 鉴权图片应通过 API 受控访问，不直接暴露对象存储地址。

## 5. 子规格地图

- 顶层规格：`docs/spec/SAAS_SPEC.md`
- RBAC 规格：`docs/spec/RBAC_SPEC.md`
- 平台后台规格：`docs/spec/ADMIN_BACKOFFICE_SPEC.md`
- AI 一期业务规格：`docs/spec/AI_PHASE_A.md`
- AI 系统设计规格：`docs/spec/AI_SYSTEM_DESIGN.md`
- AI 配额与计费规格：`docs/spec/AI_QUOTA_BILLING.md`

## 6. 旧文档说明

仓库中历史文档可能仍包含早期示例（如旧路由写法）。
以本文与当前代码实现为准。
