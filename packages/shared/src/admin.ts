import { z } from 'zod';

import { authEmailSchema, authUserSchema } from './auth';
import { tenantSubscriptionSchema } from './subscription';
import { tenantNameSchema, tenantRoleSchema, tenantSchema, tenantSlugSchema } from './tenant';

export const SuperAdminAuditAction = {
  ListTenants: 'admin.tenants.list',
  CreateTenant: 'admin.tenants.create',
  ListUsers: 'admin.users.list',
  UpsertTenantMember: 'admin.tenants.members.upsert',
  RemoveTenantMember: 'admin.tenants.members.remove',
  ListAuditLogs: 'admin.audit-logs.list',
  ExportAuditLogs: 'admin.audit-logs.export',
  GetTenantSubscription: 'admin.tenants.subscription.get',
  UpdateTenantSubscription: 'admin.tenants.subscription.update',
  CreateSubscriptionActivationCode: 'admin.subscription-activation-codes.create',
  SuspendTenantLifecycle: 'admin.tenants.lifecycle.suspend',
  ReactivateTenantLifecycle: 'admin.tenants.lifecycle.reactivate',
  OffboardTenantLifecycle: 'admin.tenants.lifecycle.offboard'
} as const;

export const superAdminAuditActionSchema = z.enum([
  SuperAdminAuditAction.ListTenants,
  SuperAdminAuditAction.CreateTenant,
  SuperAdminAuditAction.ListUsers,
  SuperAdminAuditAction.UpsertTenantMember,
  SuperAdminAuditAction.RemoveTenantMember,
  SuperAdminAuditAction.ListAuditLogs,
  SuperAdminAuditAction.ExportAuditLogs,
  SuperAdminAuditAction.GetTenantSubscription,
  SuperAdminAuditAction.UpdateTenantSubscription,
  SuperAdminAuditAction.CreateSubscriptionActivationCode,
  SuperAdminAuditAction.SuspendTenantLifecycle,
  SuperAdminAuditAction.ReactivateTenantLifecycle,
  SuperAdminAuditAction.OffboardTenantLifecycle
]);

export const adminUserSchema = authUserSchema.extend({
  createdAt: z.string().datetime()
});

export const adminTenantSchema = tenantSchema.extend({
  createdAt: z.string().datetime(),
  memberCount: z.number().int().nonnegative()
});

export const listAdminTenantsQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional()
});

export const listAdminTenantsResponseSchema = z.object({
  tenants: z.array(adminTenantSchema)
});

export const getAdminTenantResponseSchema = z.object({
  tenant: adminTenantSchema
});

export const createAdminTenantRequestSchema = z.object({
  slug: tenantSlugSchema,
  name: tenantNameSchema
});

export const createAdminTenantResponseSchema = z.object({
  tenant: adminTenantSchema
});

export const suspendAdminTenantRequestSchema = z.object({
  reason: z.string().trim().min(1).max(255)
});

export const suspendAdminTenantResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
});

export const reactivateAdminTenantResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
});

export const offboardAdminTenantRequestSchema = z.object({
  reason: z.string().trim().min(1).max(255),
  confirmTenantSlug: tenantSlugSchema
});

export const offboardAdminTenantResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
});

export const listAdminUsersResponseSchema = z.object({
  users: z.array(adminUserSchema)
});

export const adminTenantMemberSchema = z.object({
  tenantId: z.string().min(1),
  user: authUserSchema,
  role: tenantRoleSchema,
  joinedAt: z.string().datetime()
});

export const listAdminTenantMembersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional()
});

export const listAdminTenantMembersResponseSchema = z.object({
  tenantId: z.string().min(1),
  members: z.array(adminTenantMemberSchema)
});

export const upsertTenantMemberRequestSchema = z.object({
  email: authEmailSchema,
  role: tenantRoleSchema
});

export const upsertTenantMemberResponseSchema = z.object({
  tenantId: z.string().min(1),
  user: authUserSchema,
  role: tenantRoleSchema,
  joinedAt: z.string().datetime(),
  created: z.boolean(),
  previousRole: tenantRoleSchema.nullable(),
  auditLogId: z.string().min(1)
});

export const deleteTenantMemberResponseSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  removed: z.boolean(),
  previousRole: tenantRoleSchema.nullable(),
  auditLogId: z.string().min(1)
});

export const superAdminAuditLogSchema = z.object({
  id: z.string().min(1),
  actorUserId: z.string().min(1),
  actorUserEmail: authEmailSchema.nullable(),
  targetTenantId: z.string().min(1).nullable(),
  targetTenantSlug: tenantSlugSchema.nullable(),
  action: superAdminAuditActionSchema,
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime()
});

export const listSuperAdminAuditLogsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  action: superAdminAuditActionSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const listSuperAdminAuditLogsResponseSchema = z.object({
  logs: z.array(superAdminAuditLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(1)
});

export const exportSuperAdminAuditLogsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  action: superAdminAuditActionSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(2000)
});

export type SuperAdminAuditActionType =
  (typeof SuperAdminAuditAction)[keyof typeof SuperAdminAuditAction];
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminTenant = z.infer<typeof adminTenantSchema>;
export type ListAdminTenantsQuery = z.infer<typeof listAdminTenantsQuerySchema>;
export type CreateAdminTenantRequest = z.infer<typeof createAdminTenantRequestSchema>;
export type CreateAdminTenantResponse = z.infer<typeof createAdminTenantResponseSchema>;
export type SuspendAdminTenantRequest = z.infer<typeof suspendAdminTenantRequestSchema>;
export type SuspendAdminTenantResponse = z.infer<typeof suspendAdminTenantResponseSchema>;
export type ReactivateAdminTenantResponse = z.infer<typeof reactivateAdminTenantResponseSchema>;
export type OffboardAdminTenantRequest = z.infer<typeof offboardAdminTenantRequestSchema>;
export type OffboardAdminTenantResponse = z.infer<typeof offboardAdminTenantResponseSchema>;
export type GetAdminTenantResponse = z.infer<typeof getAdminTenantResponseSchema>;
export type ListAdminTenantsResponse = z.infer<typeof listAdminTenantsResponseSchema>;
export type ListAdminUsersResponse = z.infer<typeof listAdminUsersResponseSchema>;
export type AdminTenantMember = z.infer<typeof adminTenantMemberSchema>;
export type ListAdminTenantMembersQuery = z.infer<typeof listAdminTenantMembersQuerySchema>;
export type ListAdminTenantMembersResponse = z.infer<typeof listAdminTenantMembersResponseSchema>;
export type UpsertTenantMemberRequest = z.infer<typeof upsertTenantMemberRequestSchema>;
export type UpsertTenantMemberResponse = z.infer<typeof upsertTenantMemberResponseSchema>;
export type DeleteTenantMemberResponse = z.infer<typeof deleteTenantMemberResponseSchema>;
export type SuperAdminAuditLog = z.infer<typeof superAdminAuditLogSchema>;
export type ListSuperAdminAuditLogsQuery = z.infer<typeof listSuperAdminAuditLogsQuerySchema>;
export type ListSuperAdminAuditLogsResponse = z.infer<typeof listSuperAdminAuditLogsResponseSchema>;
export type ExportSuperAdminAuditLogsQuery = z.infer<typeof exportSuperAdminAuditLogsQuerySchema>;
