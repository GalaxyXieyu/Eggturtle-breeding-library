import {
  AuditAction,
  SuperAdminAuditAction,
  type AdminUsageLimitStatus,
  type AdminUsageMetricKey,
  type AuditActionType,
  type SuperAdminAuditActionType,
  type TenantRole,
  type TenantSubscriptionPlan,
  type TenantSubscriptionStatus,
} from '@eggturtle/shared';

import type { UiLocale } from '@/components/ui-preferences';

export const PLAN_MESSAGES: Record<UiLocale, Record<TenantSubscriptionPlan, string>> = {
  zh: {
    FREE: '免费版',
    BASIC: '基础版',
    PRO: '专业版',
  },
  en: {
    FREE: 'Free',
    BASIC: 'Basic',
    PRO: 'Pro',
  },
};

export const TENANT_ROLE_MESSAGES: Record<UiLocale, Record<TenantRole, string>> = {
  zh: {
    OWNER: '所有者',
    ADMIN: '管理员',
    EDITOR: '编辑者',
    VIEWER: '查看者',
  },
  en: {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    EDITOR: 'Editor',
    VIEWER: 'Viewer',
  },
};

export const SUBSCRIPTION_STATUS_MESSAGES: Record<UiLocale, Record<TenantSubscriptionStatus, string>> = {
  zh: {
    ACTIVE: '生效中',
    DISABLED: '已冻结',
    EXPIRED: '已过期',
  },
  en: {
    ACTIVE: 'Active',
    DISABLED: 'Disabled',
    EXPIRED: 'Expired',
  },
};

export const USAGE_METRIC_MESSAGES: Record<UiLocale, Record<AdminUsageMetricKey, string>> = {
  zh: {
    products: '产品数',
    images: '图片数',
    shares: '分享数',
    storageBytes: '存储用量',
  },
  en: {
    products: 'Products',
    images: 'Images',
    shares: 'Shares',
    storageBytes: 'Storage',
  },
};

export const USAGE_STATUS_MESSAGES: Record<UiLocale, Record<AdminUsageLimitStatus, string>> = {
  zh: {
    ok: '正常',
    near_limit: '接近上限',
    exceeded: '已超限',
    unlimited: '不限制',
  },
  en: {
    ok: 'OK',
    near_limit: 'Near limit',
    exceeded: 'Exceeded',
    unlimited: 'Unlimited',
  },
};

export const SUPER_ADMIN_AUDIT_ACTION_MESSAGES: Record<UiLocale, Record<SuperAdminAuditActionType, string>> = {
  zh: {
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
    [SuperAdminAuditAction.GetRevenueOverview]: '查看营收概览',
  },
  en: {
    [SuperAdminAuditAction.ListTenants]: 'View tenants',
    [SuperAdminAuditAction.CreateTenant]: 'Create tenant',
    [SuperAdminAuditAction.ListUsers]: 'View users',
    [SuperAdminAuditAction.UpsertTenantMember]: 'Upsert member role',
    [SuperAdminAuditAction.RemoveTenantMember]: 'Remove member',
    [SuperAdminAuditAction.GetPlatformBranding]: 'View platform branding',
    [SuperAdminAuditAction.UpdatePlatformBranding]: 'Update platform branding',
    [SuperAdminAuditAction.GetTenantBranding]: 'View tenant branding',
    [SuperAdminAuditAction.UpdateTenantBranding]: 'Update tenant branding',
    [SuperAdminAuditAction.ListAuditLogs]: 'View audit logs',
    [SuperAdminAuditAction.ExportAuditLogs]: 'Export audit logs',
    [SuperAdminAuditAction.GetTenantSubscription]: 'View tenant subscription',
    [SuperAdminAuditAction.UpdateTenantSubscription]: 'Update tenant subscription',
    [SuperAdminAuditAction.CreateSubscriptionActivationCode]: 'Create activation code',
    [SuperAdminAuditAction.SuspendTenantLifecycle]: 'Suspend tenant',
    [SuperAdminAuditAction.ReactivateTenantLifecycle]: 'Reactivate tenant',
    [SuperAdminAuditAction.OffboardTenantLifecycle]: 'Offboard tenant',
    [SuperAdminAuditAction.GetActivityAnalyticsOverview]: 'View activity analytics overview',
    [SuperAdminAuditAction.GetActivityOverview]: 'View activity overview',
    [SuperAdminAuditAction.GetUsageOverview]: 'View usage overview',
    [SuperAdminAuditAction.GetTenantUsage]: 'View tenant usage',
    [SuperAdminAuditAction.GetRevenueOverview]: 'View revenue overview',
  },
};

export const BUSINESS_AUDIT_ACTION_MESSAGES: Record<UiLocale, Record<AuditActionType, string>> = {
  zh: {
    [AuditAction.ProductCreate]: '新建产品',
    [AuditAction.ProductUpdate]: '编辑产品',
    [AuditAction.ProductEventCreate]: '新增产品事件',
    [AuditAction.ProductEventUpdate]: '编辑产品事件',
    [AuditAction.ProductEventDelete]: '删除产品事件',
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
    [AuditAction.SubscriptionOrderCreate]: '创建支付订单',
    [AuditAction.SubscriptionPaymentDialogOpen]: '打开支付弹窗',
    [AuditAction.SubscriptionPaymentClick]: '点击立即支付',
    [AuditAction.SubscriptionPaymentHesitate]: '支付犹豫 / 放弃',
    [AuditAction.SubscriptionPaymentCancel]: '取消支付',
    [AuditAction.SubscriptionPaymentSuccess]: '支付成功',
    [AuditAction.SubscriptionPaymentFailure]: '支付失败',
    [AuditAction.AuthLogin]: '登录',
  },
  en: {
    [AuditAction.ProductCreate]: 'Create product',
    [AuditAction.ProductUpdate]: 'Update product',
    [AuditAction.ProductEventCreate]: 'Create product event',
    [AuditAction.ProductEventUpdate]: 'Update product event',
    [AuditAction.ProductEventDelete]: 'Delete product event',
    [AuditAction.ProductImageUpload]: 'Upload image',
    [AuditAction.ProductImageDelete]: 'Delete image',
    [AuditAction.ProductImageSetMain]: 'Set main image',
    [AuditAction.ProductImageReorder]: 'Reorder images',
    [AuditAction.ProductCertificateConfirm]: 'Confirm certificate generation',
    [AuditAction.ProductCertificateVoid]: 'Void certificate',
    [AuditAction.ProductCertificateReissue]: 'Reissue certificate',
    [AuditAction.ProductCouplePhotoGenerate]: 'Generate pairing photo',
    [AuditAction.SaleBatchCreate]: 'Create sale batch',
    [AuditAction.SaleAllocationCreate]: 'Create allocation record',
    [AuditAction.SaleSubjectMediaUpload]: 'Upload sale media',
    [AuditAction.ShareCreate]: 'Create share',
    [AuditAction.ShareAccess]: 'Access share',
    [AuditAction.SubscriptionActivationRedeem]: 'Redeem activation code',
    [AuditAction.SubscriptionOrderCreate]: 'Create payment order',
    [AuditAction.SubscriptionPaymentDialogOpen]: 'Open payment dialog',
    [AuditAction.SubscriptionPaymentClick]: 'Click pay now',
    [AuditAction.SubscriptionPaymentHesitate]: 'Payment hesitation / abandon',
    [AuditAction.SubscriptionPaymentCancel]: 'Cancel payment',
    [AuditAction.SubscriptionPaymentSuccess]: 'Payment success',
    [AuditAction.SubscriptionPaymentFailure]: 'Payment failure',
    [AuditAction.AuthLogin]: 'Sign in',
  },
};
