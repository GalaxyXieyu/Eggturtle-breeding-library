import {
  SuperAdminAuditAction,
  type AdminUsageLimitStatus,
  type AdminUsageMetricKey,
  type SuperAdminAuditActionType,
  type TenantRole,
  type TenantSubscriptionPlan,
  type TenantSubscriptionStatus
} from '@eggturtle/shared';

const PLAN_LABELS: Record<TenantSubscriptionPlan, string> = {
  FREE: '免费版',
  BASIC: '基础版',
  PRO: '专业版'
};

const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  EDITOR: '编辑者',
  VIEWER: '查看者'
};

const SUBSCRIPTION_STATUS_LABELS: Record<TenantSubscriptionStatus, string> = {
  ACTIVE: '生效中',
  DISABLED: '已冻结',
  EXPIRED: '已过期'
};

const USAGE_METRIC_LABELS: Record<AdminUsageMetricKey, string> = {
  products: '产品数',
  images: '图片数',
  shares: '分享数',
  storageBytes: '存储用量'
};

const USAGE_STATUS_LABELS: Record<AdminUsageLimitStatus, string> = {
  ok: '正常',
  near_limit: '接近上限',
  exceeded: '已超限',
  unlimited: '不限制'
};

const AUDIT_ACTION_LABELS: Record<SuperAdminAuditActionType, string> = {
  [SuperAdminAuditAction.ListTenants]: '查看用户列表',
  [SuperAdminAuditAction.CreateTenant]: '创建用户',
  [SuperAdminAuditAction.ListUsers]: '查看用户列表',
  [SuperAdminAuditAction.UpsertTenantMember]: '新增或更新成员角色',
  [SuperAdminAuditAction.RemoveTenantMember]: '移除成员',
  [SuperAdminAuditAction.ListAuditLogs]: '查看审计日志',
  [SuperAdminAuditAction.ExportAuditLogs]: '导出审计日志',
  [SuperAdminAuditAction.GetTenantSubscription]: '查看用户订阅',
  [SuperAdminAuditAction.UpdateTenantSubscription]: '更新用户订阅',
  [SuperAdminAuditAction.CreateSubscriptionActivationCode]: '创建激活码',
  [SuperAdminAuditAction.SuspendTenantLifecycle]: '冻结用户',
  [SuperAdminAuditAction.ReactivateTenantLifecycle]: '恢复用户',
  [SuperAdminAuditAction.OffboardTenantLifecycle]: '用户下线',
  [SuperAdminAuditAction.GetActivityAnalyticsOverview]: '查看活跃分析概览',
  [SuperAdminAuditAction.GetActivityOverview]: '查看活跃度概览',
  [SuperAdminAuditAction.GetUsageOverview]: '查看用量概览',
  [SuperAdminAuditAction.GetTenantUsage]: '查看用户用量',
  [SuperAdminAuditAction.GetRevenueOverview]: '查看营收概览'
};

export function formatPlanLabel(plan: TenantSubscriptionPlan | string) {
  return PLAN_LABELS[plan as TenantSubscriptionPlan] ?? plan;
}

export function formatTenantRoleLabel(role: TenantRole | string) {
  return TENANT_ROLE_LABELS[role as TenantRole] ?? role;
}

export function formatSubscriptionStatusLabel(status: TenantSubscriptionStatus | string) {
  return SUBSCRIPTION_STATUS_LABELS[status as TenantSubscriptionStatus] ?? status;
}

export function formatUsageMetricLabel(metric: AdminUsageMetricKey | string) {
  return USAGE_METRIC_LABELS[metric as AdminUsageMetricKey] ?? metric;
}

export function formatUsageStatusLabel(status: AdminUsageLimitStatus | string) {
  return USAGE_STATUS_LABELS[status as AdminUsageLimitStatus] ?? status;
}

export function formatAuditActionLabel(action: SuperAdminAuditActionType | string) {
  return AUDIT_ACTION_LABELS[action as SuperAdminAuditActionType] ?? action;
}
