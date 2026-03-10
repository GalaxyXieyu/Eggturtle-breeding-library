import { z } from 'zod'

import { auditLogSchema } from './audit'
import { authEmailSchema, authPhoneNumberSchema, authUserSchema } from './auth'
import {
  tenantSubscriptionPlanSchema,
  tenantSubscriptionSchema,
  tenantSubscriptionStatusSchema
} from './subscription'
import { tenantNameSchema, tenantRoleSchema, tenantSchema, tenantSlugSchema } from './tenant'

export const SuperAdminAuditAction = {
  ListTenants: 'admin.tenants.list',
  CreateTenant: 'admin.tenants.create',
  ListUsers: 'admin.users.list',
  UpsertTenantMember: 'admin.tenants.members.upsert',
  RemoveTenantMember: 'admin.tenants.members.remove',
  GetPlatformBranding: 'admin.branding.platform.get',
  UpdatePlatformBranding: 'admin.branding.platform.update',
  GetTenantBranding: 'admin.branding.tenant.get',
  UpdateTenantBranding: 'admin.branding.tenant.update',
  ListAuditLogs: 'admin.audit-logs.list',
  ExportAuditLogs: 'admin.audit-logs.export',
  GetTenantSubscription: 'admin.tenants.subscription.get',
  UpdateTenantSubscription: 'admin.tenants.subscription.update',
  CreateSubscriptionActivationCode: 'admin.subscription-activation-codes.create',
  SuspendTenantLifecycle: 'admin.tenants.lifecycle.suspend',
  ReactivateTenantLifecycle: 'admin.tenants.lifecycle.reactivate',
  OffboardTenantLifecycle: 'admin.tenants.lifecycle.offboard',
  GetActivityAnalyticsOverview: 'admin.analytics.activity.overview',
  GetActivityOverview: 'admin.analytics.activity.overview.get',
  GetUsageOverview: 'admin.analytics.usage.overview.get',
  GetTenantUsage: 'admin.tenants.usage.get',
  GetRevenueOverview: 'admin.analytics.revenue.overview.get'
} as const

export const superAdminAuditActionSchema = z.enum([
  SuperAdminAuditAction.ListTenants,
  SuperAdminAuditAction.CreateTenant,
  SuperAdminAuditAction.ListUsers,
  SuperAdminAuditAction.UpsertTenantMember,
  SuperAdminAuditAction.RemoveTenantMember,
  SuperAdminAuditAction.GetPlatformBranding,
  SuperAdminAuditAction.UpdatePlatformBranding,
  SuperAdminAuditAction.GetTenantBranding,
  SuperAdminAuditAction.UpdateTenantBranding,
  SuperAdminAuditAction.ListAuditLogs,
  SuperAdminAuditAction.ExportAuditLogs,
  SuperAdminAuditAction.GetTenantSubscription,
  SuperAdminAuditAction.UpdateTenantSubscription,
  SuperAdminAuditAction.CreateSubscriptionActivationCode,
  SuperAdminAuditAction.SuspendTenantLifecycle,
  SuperAdminAuditAction.ReactivateTenantLifecycle,
  SuperAdminAuditAction.OffboardTenantLifecycle,
  SuperAdminAuditAction.GetActivityAnalyticsOverview,
  SuperAdminAuditAction.GetActivityOverview,
  SuperAdminAuditAction.GetUsageOverview,
  SuperAdminAuditAction.GetTenantUsage,
  SuperAdminAuditAction.GetRevenueOverview
])

export const adminUserSchema = authUserSchema.extend({
  createdAt: z.string().datetime()
})

export const adminTenantOwnerSchema = z.object({
  id: z.string().min(1),
  email: authEmailSchema,
  account: z.string().nullable(),
  name: z.string().nullable(),
  phone: authPhoneNumberSchema.nullable()
})

export const adminTenantSubscriptionSummarySchema = z.object({
  plan: tenantSubscriptionPlanSchema,
  status: tenantSubscriptionStatusSchema,
  expiresAt: z.string().datetime().nullable()
})

export const adminTenantAutoTagKeySchema = z.enum([
  'high_activity',
  'low_activity',
  'silent',
  'expiring_soon',
  'frozen',
  'no_owner',
  'collaborative',
  'high_upload',
  'high_share',
  'high_storage'
])

export const adminTenantAutoTagToneSchema = z.enum([
  'neutral',
  'accent',
  'success',
  'warning',
  'danger',
  'info'
])

export const adminTenantAutoTagSchema = z.object({
  key: adminTenantAutoTagKeySchema,
  label: z.string().min(1),
  description: z.string().min(1),
  tone: adminTenantAutoTagToneSchema,
  priority: z.number().int().min(0)
})

export const adminTenantLoginMetricsSchema = z.object({
  totalLogins: z.number().int().nonnegative(),
  logins30d: z.number().int().nonnegative(),
  lastLoginAt: z.string().datetime().nullable()
})

export const adminTenantBusinessMetricsSchema = z.object({
  activeDays30d: z.number().int().nonnegative(),
  lastBusinessActivityAt: z.string().datetime().nullable(),
  totalProducts: z.number().int().nonnegative(),
  totalImages: z.number().int().nonnegative(),
  totalShares: z.number().int().nonnegative(),
  uploads30d: z.number().int().nonnegative()
})

export const adminTenantSchema = tenantSchema.extend({
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
  lastBusinessActivityAt: z.string().datetime().nullable(),
  lastActiveAt: z.string().datetime().nullable(),
  memberCount: z.number().int().nonnegative(),
  owner: adminTenantOwnerSchema.nullable().optional(),
  subscription: adminTenantSubscriptionSummarySchema.nullable().optional(),
  autoTags: z.array(adminTenantAutoTagSchema).default([])
})

export const listAdminTenantsQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional()
})

export const listAdminTenantsResponseSchema = z.object({
  tenants: z.array(adminTenantSchema)
})

export const getAdminTenantResponseSchema = z.object({
  tenant: adminTenantSchema
})

export const createAdminTenantRequestSchema = z.object({
  slug: tenantSlugSchema,
  name: tenantNameSchema
})

export const createAdminTenantResponseSchema = z.object({
  tenant: adminTenantSchema
})

export const suspendAdminTenantRequestSchema = z.object({
  reason: z.string().trim().min(1).max(255)
})

export const suspendAdminTenantResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
})

export const reactivateAdminTenantResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
})

export const offboardAdminTenantRequestSchema = z.object({
  reason: z.string().trim().min(1).max(255),
  confirmTenantSlug: tenantSlugSchema
})

export const offboardAdminTenantResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
})

export const listAdminUsersResponseSchema = z.object({
  users: z.array(adminUserSchema)
})

export const adminTenantMemberSchema = z.object({
  tenantId: z.string().min(1),
  user: authUserSchema,
  role: tenantRoleSchema,
  joinedAt: z.string().datetime()
})

export const listAdminTenantMembersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional()
})

export const listAdminTenantMembersResponseSchema = z.object({
  tenantId: z.string().min(1),
  members: z.array(adminTenantMemberSchema)
})

export const upsertTenantMemberRequestSchema = z.object({
  email: authEmailSchema,
  role: tenantRoleSchema
})

export const upsertTenantMemberResponseSchema = z.object({
  tenantId: z.string().min(1),
  user: authUserSchema,
  role: tenantRoleSchema,
  joinedAt: z.string().datetime(),
  created: z.boolean(),
  previousRole: tenantRoleSchema.nullable(),
  auditLogId: z.string().min(1)
})

export const deleteTenantMemberResponseSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  removed: z.boolean(),
  previousRole: tenantRoleSchema.nullable(),
  auditLogId: z.string().min(1)
})

export const superAdminAuditLogSchema = z.object({
  id: z.string().min(1),
  actorUserId: z.string().min(1),
  actorUserEmail: authEmailSchema.nullable(),
  targetTenantId: z.string().min(1).nullable(),
  targetTenantSlug: tenantSlugSchema.nullable(),
  action: superAdminAuditActionSchema,
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime()
})

export const listSuperAdminAuditLogsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  action: superAdminAuditActionSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

export const listSuperAdminAuditLogsResponseSchema = z.object({
  logs: z.array(superAdminAuditLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
})

export const exportSuperAdminAuditLogsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  action: superAdminAuditActionSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(2000)
})

export const adminActivityOverviewWindowSchema = z.enum(['7d', '30d'])

export const getAdminActivityOverviewQuerySchema = z.object({
  window: adminActivityOverviewWindowSchema.default('30d')
})

export const adminActivityOverviewResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  window: adminActivityOverviewWindowSchema,
  kpis: z.object({
    dau: z.number().int().nonnegative(),
    wau: z.number().int().nonnegative(),
    mau: z.number().int().nonnegative(),
    activeTenants7d: z.number().int().nonnegative(),
    tenantRetention7d: z.number().min(0).max(1)
  }),
  trend: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dau: z.number().int().nonnegative(),
      activeTenants: z.number().int().nonnegative()
    })
  ),
  definitions: z.object({
    activeTenant: z.string().min(1),
    tenantRetention7d: z.string().min(1)
  })
})

export const adminUsageLimitStatusSchema = z.enum(['ok', 'near_limit', 'exceeded', 'unlimited'])
export const adminUsageMetricKeySchema = z.enum(['products', 'images', 'shares', 'storageBytes'])

export const adminUsageCountMetricSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive().nullable(),
  utilization: z.number().min(0).nullable(),
  status: adminUsageLimitStatusSchema
})

export const adminUsageStorageMetricSchema = z.object({
  usedBytes: z.string().regex(/^\d+$/),
  limitBytes: z.string().regex(/^\d+$/).nullable(),
  utilization: z.number().min(0).nullable(),
  status: adminUsageLimitStatusSchema
})

export const adminTenantUsageAlertSchema = z.object({
  metric: adminUsageMetricKeySchema,
  status: z.enum(['near_limit', 'exceeded']),
  message: z.string().min(1)
})

export const adminTenantUsageSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: tenantSlugSchema,
  tenantName: tenantNameSchema,
  plan: tenantSubscriptionPlanSchema,
  subscriptionStatus: tenantSubscriptionStatusSchema,
  usage: z.object({
    products: adminUsageCountMetricSchema,
    images: adminUsageCountMetricSchema,
    shares: adminUsageCountMetricSchema,
    storageBytes: adminUsageStorageMetricSchema
  }),
  alerts: z.array(adminTenantUsageAlertSchema),
  usageScore: z.number().nonnegative()
})

export const getAdminUsageOverviewQuerySchema = z.object({
  topN: z.coerce.number().int().min(1).max(50).default(10)
})

export const adminUsageOverviewResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  topN: z.number().int().min(1),
  summary: z.object({
    tenantCount: z.number().int().nonnegative(),
    totalProducts: z.number().int().nonnegative(),
    totalImages: z.number().int().nonnegative(),
    totalShares: z.number().int().nonnegative(),
    totalStorageBytes: z.string().regex(/^\d+$/),
    nearLimitTenantCount: z.number().int().nonnegative(),
    exceededTenantCount: z.number().int().nonnegative()
  }),
  topTenants: z.array(adminTenantUsageSchema),
  definitions: z.object({
    score: z.string().min(1),
    nearLimit: z.string().min(1),
    exceeded: z.string().min(1)
  })
})

export const getAdminTenantUsageResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  tenant: adminTenantUsageSchema,
  definitions: z.object({
    products: z.string().min(1),
    images: z.string().min(1),
    shares: z.string().min(1),
    storageBytes: z.string().min(1),
    nearLimit: z.string().min(1),
    exceeded: z.string().min(1)
  })
})

export const adminTenantInsightsSchema = z.object({
  tenant: adminTenantSchema,
  autoTags: z.array(adminTenantAutoTagSchema),
  loginMetrics: adminTenantLoginMetricsSchema,
  businessMetrics: adminTenantBusinessMetricsSchema,
  usage: adminTenantUsageSchema,
  recentBusinessLogs: z.array(auditLogSchema)
})

export const getAdminTenantInsightsResponseSchema = z.object({
  insights: adminTenantInsightsSchema
})

export const adminRevenueOverviewWindowSchema = z.enum(['30d', '90d'])

export const getAdminRevenueOverviewQuerySchema = z.object({
  window: adminRevenueOverviewWindowSchema.default('30d')
})

export const adminRevenueOverviewResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  window: adminRevenueOverviewWindowSchema,
  kpis: z.object({
    activeTenantCount: z.number().int().nonnegative(),
    payingTenantCount: z.number().int().nonnegative(),
    mrrCents: z.number().int().nonnegative(),
    arrCents: z.number().int().nonnegative(),
    upgradeEvents: z.number().int().nonnegative(),
    downgradeEvents: z.number().int().nonnegative(),
    churnEvents: z.number().int().nonnegative(),
    reactivationEvents: z.number().int().nonnegative()
  }),
  planBreakdown: z.array(
    z.object({
      plan: tenantSubscriptionPlanSchema,
      activeTenantCount: z.number().int().nonnegative(),
      payingTenantCount: z.number().int().nonnegative(),
      mrrCents: z.number().int().nonnegative()
    })
  ),
  trend: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      upgrades: z.number().int().nonnegative(),
      downgrades: z.number().int().nonnegative(),
      churns: z.number().int().nonnegative(),
      reactivations: z.number().int().nonnegative()
    })
  ),
  priceBookMonthlyCents: z.object({
    FREE: z.number().int().nonnegative(),
    BASIC: z.number().int().nonnegative(),
    PRO: z.number().int().nonnegative()
  }),
  definitions: z.object({
    mrr: z.string().min(1),
    arr: z.string().min(1),
    trend: z.string().min(1)
  })
})

export type SuperAdminAuditActionType =
  (typeof SuperAdminAuditAction)[keyof typeof SuperAdminAuditAction]
export type AdminUser = z.infer<typeof adminUserSchema>
export type AdminTenantOwner = z.infer<typeof adminTenantOwnerSchema>
export type AdminTenantSubscriptionSummary = z.infer<typeof adminTenantSubscriptionSummarySchema>
export type AdminTenantAutoTagKey = z.infer<typeof adminTenantAutoTagKeySchema>
export type AdminTenantAutoTagTone = z.infer<typeof adminTenantAutoTagToneSchema>
export type AdminTenantAutoTag = z.infer<typeof adminTenantAutoTagSchema>
export type AdminTenantLoginMetrics = z.infer<typeof adminTenantLoginMetricsSchema>
export type AdminTenantBusinessMetrics = z.infer<typeof adminTenantBusinessMetricsSchema>
export type AdminTenant = z.infer<typeof adminTenantSchema>
export type ListAdminTenantsQuery = z.infer<typeof listAdminTenantsQuerySchema>
export type CreateAdminTenantRequest = z.infer<typeof createAdminTenantRequestSchema>
export type CreateAdminTenantResponse = z.infer<typeof createAdminTenantResponseSchema>
export type SuspendAdminTenantRequest = z.infer<typeof suspendAdminTenantRequestSchema>
export type SuspendAdminTenantResponse = z.infer<typeof suspendAdminTenantResponseSchema>
export type ReactivateAdminTenantResponse = z.infer<typeof reactivateAdminTenantResponseSchema>
export type OffboardAdminTenantRequest = z.infer<typeof offboardAdminTenantRequestSchema>
export type OffboardAdminTenantResponse = z.infer<typeof offboardAdminTenantResponseSchema>
export type GetAdminTenantResponse = z.infer<typeof getAdminTenantResponseSchema>
export type GetAdminTenantInsightsResponse = z.infer<typeof getAdminTenantInsightsResponseSchema>
export type ListAdminTenantsResponse = z.infer<typeof listAdminTenantsResponseSchema>
export type ListAdminUsersResponse = z.infer<typeof listAdminUsersResponseSchema>
export type AdminTenantMember = z.infer<typeof adminTenantMemberSchema>
export type ListAdminTenantMembersQuery = z.infer<typeof listAdminTenantMembersQuerySchema>
export type ListAdminTenantMembersResponse = z.infer<typeof listAdminTenantMembersResponseSchema>
export type UpsertTenantMemberRequest = z.infer<typeof upsertTenantMemberRequestSchema>
export type UpsertTenantMemberResponse = z.infer<typeof upsertTenantMemberResponseSchema>
export type DeleteTenantMemberResponse = z.infer<typeof deleteTenantMemberResponseSchema>
export type SuperAdminAuditLog = z.infer<typeof superAdminAuditLogSchema>
export type ListSuperAdminAuditLogsQuery = z.infer<typeof listSuperAdminAuditLogsQuerySchema>
export type ListSuperAdminAuditLogsResponse = z.infer<typeof listSuperAdminAuditLogsResponseSchema>
export type ExportSuperAdminAuditLogsQuery = z.infer<typeof exportSuperAdminAuditLogsQuerySchema>
export type AdminActivityOverviewWindow = z.infer<typeof adminActivityOverviewWindowSchema>
export type GetAdminActivityOverviewQuery = z.infer<typeof getAdminActivityOverviewQuerySchema>
export type AdminActivityOverviewResponse = z.infer<typeof adminActivityOverviewResponseSchema>
export type AdminUsageLimitStatus = z.infer<typeof adminUsageLimitStatusSchema>
export type AdminUsageMetricKey = z.infer<typeof adminUsageMetricKeySchema>
export type AdminUsageCountMetric = z.infer<typeof adminUsageCountMetricSchema>
export type AdminUsageStorageMetric = z.infer<typeof adminUsageStorageMetricSchema>
export type AdminTenantUsageAlert = z.infer<typeof adminTenantUsageAlertSchema>
export type AdminTenantUsage = z.infer<typeof adminTenantUsageSchema>
export type AdminTenantInsights = z.infer<typeof adminTenantInsightsSchema>
export type GetAdminUsageOverviewQuery = z.infer<typeof getAdminUsageOverviewQuerySchema>
export type AdminUsageOverviewResponse = z.infer<typeof adminUsageOverviewResponseSchema>
export type GetAdminTenantUsageResponse = z.infer<typeof getAdminTenantUsageResponseSchema>
export type AdminRevenueOverviewWindow = z.infer<typeof adminRevenueOverviewWindowSchema>
export type GetAdminRevenueOverviewQuery = z.infer<typeof getAdminRevenueOverviewQuerySchema>
export type AdminRevenueOverviewResponse = z.infer<typeof adminRevenueOverviewResponseSchema>
