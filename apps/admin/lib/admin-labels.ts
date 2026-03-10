import {
  AuditAction,
  SuperAdminAuditAction,
  type AdminUsageLimitStatus,
  type AdminUsageMetricKey,
  type AuditActionType,
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

const SUPER_ADMIN_AUDIT_ACTION_LABELS: Record<SuperAdminAuditActionType, string> = {
  [SuperAdminAuditAction.ListTenants]: '查看用户列表',
  [SuperAdminAuditAction.CreateTenant]: '创建用户',
  [SuperAdminAuditAction.ListUsers]: '查看用户列表',
  [SuperAdminAuditAction.UpsertTenantMember]: '新增或更新成员角色',
  [SuperAdminAuditAction.RemoveTenantMember]: '移除成员',
  [SuperAdminAuditAction.GetPlatformBranding]: '查看平台品牌',
  [SuperAdminAuditAction.UpdatePlatformBranding]: '更新平台品牌',
  [SuperAdminAuditAction.GetTenantBranding]: '查看租户品牌',
  [SuperAdminAuditAction.UpdateTenantBranding]: '更新租户品牌',
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

const BUSINESS_AUDIT_ACTION_LABELS: Record<AuditActionType, string> = {
  [AuditAction.ProductCreate]: '新建产品',
  [AuditAction.ProductUpdate]: '编辑产品',
  [AuditAction.ProductEventCreate]: '新增产品事件',
  [AuditAction.ProductImageUpload]: '上传图片',
  [AuditAction.ProductImageDelete]: '删除图片',
  [AuditAction.ProductImageSetMain]: '设为主图',
  [AuditAction.ProductImageReorder]: '调整图片顺序',
  [AuditAction.ProductCertificateConfirm]: '确认生成证书',
  [AuditAction.ProductCertificateVoid]: '作废证书',
  [AuditAction.ProductCertificateReissue]: '补发证书',
  [AuditAction.ProductCouplePhotoGenerate]: '生成配对图',
  [AuditAction.SaleBatchCreate]: '创建销售批次',
  [AuditAction.SaleAllocationCreate]: '创建分配记录',
  [AuditAction.SaleSubjectMediaUpload]: '上传销售素材',
  [AuditAction.ShareCreate]: '创建分享',
  [AuditAction.ShareAccess]: '访问分享',
  [AuditAction.SubscriptionActivationRedeem]: '兑换激活码',
  [AuditAction.AuthLogin]: '登录'
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
  return SUPER_ADMIN_AUDIT_ACTION_LABELS[action as SuperAdminAuditActionType] ?? action;
}

export function formatBusinessAuditActionLabel(action: AuditActionType | string) {
  return BUSINESS_AUDIT_ACTION_LABELS[action as AuditActionType] ?? action;
}
