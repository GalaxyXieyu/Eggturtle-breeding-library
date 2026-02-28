# 架构文档（单一事实来源）

更新日期：2026-02-28

## 架构定位

### apps/web - 租户端应用
- 登录后，面向单个租户的用户
- 包含：租户用户自己的产品/种龟/系列/轮播/设置管理
- 通过 RBAC 控制权限（OWNER/ADMIN 可操作，VIEWER 只读）
- 路由：`/app/[tenantSlug]/...`

### apps/admin - 平台级后台
- 面向平台运营方
- 只需要：租户管理、会员/套餐管理、审计日志、平台配置
- **不需要也不应该**去管理单个租户的业务数据
- 路由：`/dashboard/...`

### Legacy 参考
- Legacy frontend 里的完整后台管理 UI（`frontend/src/pages/admin/`）作为「产品设计蓝本」，可参考或直接迁移到 apps/web。

---

## RBAC 控制规则

### 角色定义
| 角色 | 说明 |
|-------|------|
| OWNER | 租户创建者，拥有所有权限 |
| ADMIN | 租户管理员，可管理产品/种龟/系列/轮播/设置/成员 |
| EDITOR | 编辑者，可创建/编辑产品/种龟/事件 |
| VIEWER | 只读用户，只能查看，不能编辑 |

### 默认拒绝策略
- **Deny-by-default**：所有操作默认拒绝，需显式授权。
- 所有业务表必须 `tenant_id NOT NULL`。
- 所有查询必须默认注入 `tenant_id` 过滤。

### 权限不足时的行为

#### API 端
- 权限不足时返回 **403 Forbidden**
- 响应体：
  ```json
  {
    "error": "Forbidden",
    "message": "Insufficient permissions",
    "code": "INSUFFICIENT_PERMISSIONS"
  }
  ```

#### UI 端
- **隐藏操作入口**：权限不足的按钮/菜单不显示
- **权限提示**：若直接访问受保护页面，显示「权限不足」提示页
- **表单/操作禁用**：按钮置灰，hover 提示「权限不足」

### 实现参考
- 共享类型：`packages/shared/src/tenant.ts`
- Guard：`apps/api/src/auth/rbac.guard.ts`
- Policy：`apps/api/src/auth/rbac.policy.ts`

---

## 开发执行入口

### 唯一执行计划
- `docs/plan/EggsTask.csv` - 今晚任务计划（SSOT）
- `out/plan/PROGRESS.md` - 进度与证据

### 业务规格（长期有效）
- `docs/spec/SAAS_SPEC.md` - 顶层业务规格
- `docs/spec/RBAC_SPEC.md` - RBAC 控制规则
- `docs/spec/ADMIN_BACKOFFICE_SPEC.md` - 平台后台业务规格
- `docs/spec/AI_PHASE_A.md` - AI Phase A 业务规格
- `docs/spec/AI_SYSTEM_DESIGN.md` - AI 架构设计
- `docs/spec/AI_QUOTA_BILLING.md` - AI 配额/计费规格

### 迁移路线
- `docs/migration/API_MATRIX.md` - Legacy FastAPI -> Node Nest API 接口对照
- `docs/migration/UI_MATRIX.md` - Legacy 前端 -> Node Web/Admin 页面功能对照
- `docs/migration/TODO.md` - 迁移待办清单

### 可复现证据
- `docs/evidence/*.md` - 每个阶段的验收证据（例如 `docs/evidence/t30-32-admin-smoke-20260228.md`）

---

## Legacy UI 参考清单

可参考/复用的 legacy 组件：
- 产品管理：`frontend/src/pages/admin/AdminProducts.tsx`
- 图片管理：`frontend/src/pages/admin/products/images/ProductImagesManager.tsx`
- 批量导入：`frontend/src/components/admin/ProductImportDialog.tsx`
- 种龟事件：`frontend/src/pages/admin/products/forms/BreederEventsCard.tsx`
- 系列管理：`frontend/src/pages/admin/AdminSeries.tsx`
- 轮播管理：`frontend/src/pages/admin/AdminCarouselManager.tsx`
- 设置：`frontend/src/pages/admin/AdminSettings.tsx`

这些组件使用 shadcn/ui + Radix UI，与我们 Node 端选择的技术栈一致，可参考或直接迁移到 apps/web。
