# 角色权限控制规则

更新日期：2026-02-28

## 1. 角色定义

| 角色 | 说明 |
| --- | --- |
| OWNER | 租户创建者，拥有全部权限 |
| ADMIN | 租户管理员，可管理产品/种龟/系列/轮播/设置/成员 |
| EDITOR | 编辑者，可创建与编辑产品/种龟/事件 |
| VIEWER | 只读用户，只能查看不可编辑 |

## 2. 默认拒绝策略

- 所有操作默认拒绝，必须显式授权。
- 所有业务表必须 `tenant_id NOT NULL`。
- 所有查询默认注入 `tenant_id` 过滤条件。

## 3. 权限矩阵

| 资源 | 动作 | OWNER | ADMIN | EDITOR | VIEWER |
| --- | --- | --- | --- | --- | --- |
| products | read | ✓ | ✓ | ✓ | ✓ |
| products | write | ✓ | ✓ | ✓ | ✗ |
| products | delete | ✓ | ✓ | ✗ | ✗ |
| breeders | read | ✓ | ✓ | ✓ | ✓ |
| breeders | write | ✓ | ✓ | ✓ | ✗ |
| breeders | delete | ✓ | ✓ | ✗ | ✗ |
| series | read | ✓ | ✓ | ✓ | ✓ |
| series | write | ✓ | ✓ | ✗ | ✗ |
| series | delete | ✓ | ✓ | ✗ | ✗ |
| featured-products | read | ✓ | ✓ | ✓ | ✓ |
| featured-products | write | ✓ | ✓ | ✗ | ✗ |
| carousels | read | ✓ | ✓ | ✓ | ✓ |
| carousels | write | ✓ | ✓ | ✗ | ✗ |
| shares | read | ✓ | ✓ | ✓ | ✓ |
| shares | write | ✓ | ✓ | ✓ | ✗ |
| shares | delete | ✓ | ✓ | ✗ | ✗ |
| settings | read | ✓ | ✓ | ✗ | ✗ |
| settings | write | ✓ | ✓ | ✗ | ✗ |
| members | read | ✓ | ✓ | ✗ | ✗ |
| members | write | ✓ | ✓ | ✗ | ✗ |
| members | delete | ✓ | ✗ | ✗ | ✗ |
| audit-logs | read | ✓ | ✓ | ✗ | ✗ |

## 4. 权限不足行为

### 4.1 API 端

- 权限不足返回 `403 Forbidden`
- 响应体示例：

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

### 4.2 UI 端

- 隐藏无权限操作入口（按钮/菜单不显示）
- 直接访问受限页面时显示“权限不足”提示
- 无权限按钮禁用并给出提示语

## 5. 实现参考

- 共享类型：`packages/shared/src/tenant.ts`
- Guard：`apps/api/src/auth/rbac.guard.ts`
- Policy：`apps/api/src/auth/rbac.policy.ts`
