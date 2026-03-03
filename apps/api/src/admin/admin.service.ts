import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ErrorCode, SuperAdminAuditAction } from '@eggturtle/shared';
import type {
  AdminRevenueOverviewResponse,
  AdminTenantUsage,
  CreateAdminTenantRequest,
  CreateAdminTenantResponse,
  CreateTenantSubscriptionActivationCodeRequest,
  CreateTenantSubscriptionActivationCodeResponse,
  DeleteTenantMemberResponse,
  AdminActivityOverviewResponse,
  AdminUsageOverviewResponse,
  ExportSuperAdminAuditLogsQuery,
  GetAdminActivityOverviewQuery,
  GetAdminRevenueOverviewQuery,
  GetAdminTenantResponse,
  GetAdminTenantSubscriptionResponse,
  GetAdminTenantUsageResponse,
  GetAdminUsageOverviewQuery,
  OffboardAdminTenantRequest,
  OffboardAdminTenantResponse,
  ReactivateAdminTenantResponse,
  ListAdminTenantMembersQuery,
  ListAdminTenantMembersResponse,
  ListAdminTenantsQuery,
  ListAdminTenantsResponse,
  ListAdminUsersResponse,
  ListSuperAdminAuditLogsQuery,
  ListSuperAdminAuditLogsResponse,
  SuspendAdminTenantRequest,
  SuspendAdminTenantResponse,
  UpdateTenantSubscriptionRequest,
  UpdateTenantSubscriptionResponse,
  UpsertTenantMemberRequest,
  UpsertTenantMemberResponse
} from '@eggturtle/shared';
import { Prisma, TenantMemberRole, TenantSubscriptionPlan } from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

const AUDIT_EXPORT_MAX_RANGE_DAYS = 31;
const AUDIT_EXPORT_MAX_RANGE_MS = AUDIT_EXPORT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
const ACTIVITY_WRITE_ACTIONS: Array<(typeof AuditAction)[keyof typeof AuditAction]> = [
  AuditAction.ProductCreate,
  AuditAction.ProductUpdate,
  AuditAction.ProductEventCreate,
  AuditAction.ProductImageUpload,
  AuditAction.ProductImageDelete,
  AuditAction.ProductImageSetMain,
  AuditAction.ProductImageReorder,
  AuditAction.ShareCreate,
  AuditAction.SubscriptionActivationRedeem
];
const USAGE_NEAR_LIMIT_RATIO = 0.8;
const DEFAULT_USAGE_LIMITS: Record<
  TenantSubscriptionPlan,
  { products: number | null; images: number | null; shares: number | null; storageBytes: bigint | null }
> = {
  FREE: {
    products: 10,
    images: 120,
    shares: 20,
    storageBytes: BigInt(1024 * 1024 * 1024)
  },
  BASIC: {
    products: 30,
    images: 1000,
    shares: 300,
    storageBytes: BigInt(10 * 1024 * 1024 * 1024)
  },
  PRO: {
    products: 200,
    images: 10000,
    shares: 2000,
    storageBytes: BigInt(100 * 1024 * 1024 * 1024)
  }
};
const PLAN_MONTHLY_PRICE_CENTS: Record<TenantSubscriptionPlan, number> = {
  FREE: 0,
  BASIC: 39900,
  PRO: 129900
};
const PLAN_LEVEL: Record<TenantSubscriptionPlan, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2
};
const REVENUE_TREND_ACTIONS: string[] = [
  SuperAdminAuditAction.UpdateTenantSubscription,
  SuperAdminAuditAction.SuspendTenantLifecycle,
  SuperAdminAuditAction.ReactivateTenantLifecycle,
  SuperAdminAuditAction.OffboardTenantLifecycle
];

type UsageCounterMetric = {
  used: number;
  limit: number | null;
  utilization: number | null;
  status: 'ok' | 'near_limit' | 'exceeded' | 'unlimited';
};

type UsageStorageMetric = {
  usedBytes: string;
  limitBytes: string | null;
  utilization: number | null;
  status: 'ok' | 'near_limit' | 'exceeded' | 'unlimited';
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly superAdminAuditLogsService: SuperAdminAuditLogsService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService
  ) {}

  async listTenants(
    actorUserId: string,
    query: ListAdminTenantsQuery
  ): Promise<ListAdminTenantsResponse> {
    const tenants = await this.prisma.tenant.findMany({
      where: query.search
        ? {
            OR: [
              {
                slug: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          }
        : undefined,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.ListTenants,
      metadata: {
        search: query.search ?? null,
        resultCount: tenants.length
      }
    });

    return {
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        createdAt: tenant.createdAt.toISOString(),
        memberCount: tenant._count.members
      }))
    };
  }

  async getTenant(actorUserId: string, tenantId: string): Promise<GetAdminTenantResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      include: {
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: tenant.id,
      action: SuperAdminAuditAction.ListTenants,
      metadata: {
        mode: 'detail',
        tenantSlug: tenant.slug
      }
    });

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        createdAt: tenant.createdAt.toISOString(),
        memberCount: tenant._count.members
      }
    };
  }

  async getTenantSubscription(
    actorUserId: string,
    tenantId: string
  ): Promise<GetAdminTenantSubscriptionResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: {
        id: true,
        slug: true
      }
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const subscription = await this.tenantSubscriptionsService.getSubscriptionForTenant(tenant.id);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: tenant.id,
      action: SuperAdminAuditAction.GetTenantSubscription,
      metadata: {
        tenantSlug: tenant.slug,
        isConfigured: subscription.isConfigured,
        plan: subscription.plan,
        status: subscription.status
      }
    });

    return {
      subscription
    };
  }

  async updateTenantSubscription(
    actorUserId: string,
    tenantId: string,
    payload: UpdateTenantSubscriptionRequest
  ): Promise<UpdateTenantSubscriptionResponse> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (!tenant) {
        throw new NotFoundException({
          message: 'Tenant not found.',
          errorCode: ErrorCode.TenantNotFound
        });
      }

      const subscription = await this.tenantSubscriptionsService.upsertSubscription(tenant.id, payload, tx);
      const auditLogId = await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: tenant.id,
          action: SuperAdminAuditAction.UpdateTenantSubscription,
          metadata: {
            tenantSlug: tenant.slug,
            payload,
            subscription
          }
        },
        tx
      );

      return {
        subscription,
        auditLogId
      };
    });
  }

  async suspendTenant(
    actorUserId: string,
    tenantId: string,
    payload: SuspendAdminTenantRequest
  ): Promise<SuspendAdminTenantResponse> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (!tenant) {
        throw new NotFoundException({
          message: 'Tenant not found.',
          errorCode: ErrorCode.TenantNotFound
        });
      }

      const previousSubscription = await tx.tenantSubscription.findUnique({
        where: {
          tenantId: tenant.id
        },
        select: {
          disabledAt: true,
          disabledReason: true
        }
      });

      const subscription = await this.tenantSubscriptionsService.upsertSubscription(
        tenant.id,
        {
          disabledAt: new Date().toISOString(),
          disabledReason: payload.reason
        },
        tx
      );
      const auditLogId = await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: tenant.id,
          action: SuperAdminAuditAction.SuspendTenantLifecycle,
          metadata: {
            tenantSlug: tenant.slug,
            reason: payload.reason,
            previousDisabledAt: previousSubscription?.disabledAt?.toISOString() ?? null,
            previousDisabledReason: previousSubscription?.disabledReason ?? null
          }
        },
        tx
      );

      return {
        subscription,
        auditLogId
      };
    });
  }

  async reactivateTenant(actorUserId: string, tenantId: string): Promise<ReactivateAdminTenantResponse> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (!tenant) {
        throw new NotFoundException({
          message: 'Tenant not found.',
          errorCode: ErrorCode.TenantNotFound
        });
      }

      const previousSubscription = await tx.tenantSubscription.findUnique({
        where: {
          tenantId: tenant.id
        },
        select: {
          disabledAt: true,
          disabledReason: true
        }
      });

      const subscription = await this.tenantSubscriptionsService.upsertSubscription(
        tenant.id,
        {
          disabledAt: null,
          disabledReason: null
        },
        tx
      );
      const auditLogId = await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: tenant.id,
          action: SuperAdminAuditAction.ReactivateTenantLifecycle,
          metadata: {
            tenantSlug: tenant.slug,
            previousDisabledAt: previousSubscription?.disabledAt?.toISOString() ?? null,
            previousDisabledReason: previousSubscription?.disabledReason ?? null
          }
        },
        tx
      );

      return {
        subscription,
        auditLogId
      };
    });
  }

  async offboardTenant(
    actorUserId: string,
    tenantId: string,
    payload: OffboardAdminTenantRequest
  ): Promise<OffboardAdminTenantResponse> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (!tenant) {
        throw new NotFoundException({
          message: 'Tenant not found.',
          errorCode: ErrorCode.TenantNotFound
        });
      }

      if (payload.confirmTenantSlug !== tenant.slug) {
        throw new BadRequestException({
          message: 'confirmTenantSlug must exactly match tenant slug.',
          errorCode: ErrorCode.InvalidRequestPayload
        });
      }

      const previousSubscription = await tx.tenantSubscription.findUnique({
        where: {
          tenantId: tenant.id
        },
        select: {
          disabledAt: true,
          disabledReason: true
        }
      });

      const offboardReason = `[OFFBOARD] ${payload.reason.trim()}`;
      const subscription = await this.tenantSubscriptionsService.upsertSubscription(
        tenant.id,
        {
          disabledAt: new Date().toISOString(),
          disabledReason: offboardReason
        },
        tx
      );

      const auditLogId = await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: tenant.id,
          action: SuperAdminAuditAction.OffboardTenantLifecycle,
          metadata: {
            tenantSlug: tenant.slug,
            reason: payload.reason.trim(),
            confirmTenantSlug: payload.confirmTenantSlug,
            previousDisabledAt: previousSubscription?.disabledAt?.toISOString() ?? null,
            previousDisabledReason: previousSubscription?.disabledReason ?? null,
            resultingStatus: subscription.status
          }
        },
        tx
      );

      return {
        subscription,
        auditLogId
      };
    });
  }

  async createSubscriptionActivationCode(
    actorUserId: string,
    payload: CreateTenantSubscriptionActivationCodeRequest
  ): Promise<CreateTenantSubscriptionActivationCodeResponse> {
    return this.prisma.$transaction(async (tx) => {
      let targetTenantSlug: string | null = null;
      if (payload.targetTenantId) {
        const tenant = await tx.tenant.findUnique({
          where: {
            id: payload.targetTenantId
          },
          select: {
            id: true,
            slug: true
          }
        });

        if (!tenant) {
          throw new NotFoundException({
            message: 'Tenant not found.',
            errorCode: ErrorCode.TenantNotFound
          });
        }

        targetTenantSlug = tenant.slug;
      }

      const activationCode = await this.tenantSubscriptionsService.createSubscriptionActivationCode(
        actorUserId,
        payload,
        tx
      );

      const auditLogId = await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: payload.targetTenantId ?? null,
          action: SuperAdminAuditAction.CreateSubscriptionActivationCode,
          metadata: {
            targetTenantId: payload.targetTenantId ?? null,
            targetTenantSlug,
            plan: activationCode.plan,
            durationDays: activationCode.durationDays,
            redeemLimit: activationCode.redeemLimit,
            codeLabel: activationCode.codeLabel
          }
        },
        tx
      );

      return {
        activationCode,
        auditLogId
      };
    });
  }

  async createTenant(
    actorUserId: string,
    payload: CreateAdminTenantRequest
  ): Promise<CreateAdminTenantResponse> {
    try {
      const tenant = await this.prisma.$transaction(async (tx) => {
        const createdTenant = await tx.tenant.create({
          data: {
            slug: payload.slug,
            name: payload.name
          }
        });

        await this.superAdminAuditLogsService.createLog(
          {
            actorUserId,
            targetTenantId: createdTenant.id,
            action: SuperAdminAuditAction.CreateTenant,
            metadata: {
              slug: createdTenant.slug,
              name: createdTenant.name
            }
          },
          tx
        );

        return createdTenant;
      });

      return {
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          createdAt: tenant.createdAt.toISOString(),
          memberCount: 0
        }
      };
    } catch (error) {
      if (this.isTenantSlugConflict(error)) {
        throw new ConflictException({
          message: 'Tenant slug already exists.',
          errorCode: ErrorCode.TenantSlugConflict
        });
      }

      throw error;
    }
  }

  async listUsers(actorUserId: string): Promise<ListAdminUsersResponse> {
    const users = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.ListUsers,
      metadata: {
        resultCount: users.length
      }
    });

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString()
      }))
    };
  }

  async listTenantMembers(
    actorUserId: string,
    tenantId: string,
    query: ListAdminTenantMembersQuery
  ): Promise<ListAdminTenantMembersResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      }
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const members = await this.prisma.tenantMember.findMany({
      where: {
        tenantId,
        ...(query.search
          ? {
              user: {
                email: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            }
          : {})
      },
      include: {
        user: true
      },
      orderBy: [
        {
          role: 'asc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: tenantId,
      action: SuperAdminAuditAction.ListUsers,
      metadata: {
        mode: 'tenant-members',
        search: query.search ?? null,
        resultCount: members.length
      }
    });

    return {
      tenantId,
      members: members.map((member) => ({
        tenantId,
        role: member.role,
        joinedAt: member.createdAt.toISOString(),
        user: {
          id: member.user.id,
          email: member.user.email,
          name: member.user.name
        }
      }))
    };
  }

  async upsertTenantMember(
    actorUserId: string,
    tenantId: string,
    payload: UpsertTenantMemberRequest
  ): Promise<UpsertTenantMemberResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      }
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    let result: {
      user: { id: string; email: string; name: string | null };
      membership: { role: TenantMemberRole; createdAt: Date };
      created: boolean;
      previousRole: TenantMemberRole | null;
      auditLogId: string;
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: {
            email: payload.email
          },
          update: {},
          create: {
            email: payload.email
          }
        });

        const existingMembership = await tx.tenantMember.findUnique({
          where: {
            tenantId_userId: {
              tenantId: tenant.id,
              userId: user.id
            }
          }
        });

        const membershipInOtherTenant = await tx.tenantMember.findFirst({
          where: {
            userId: user.id,
            NOT: {
              tenantId: tenant.id
            }
          },
          include: {
            tenant: {
              select: {
                slug: true
              }
            }
          }
        });

        if (membershipInOtherTenant) {
          throw new ConflictException({
            message: `User is already bound to tenant "${membershipInOtherTenant.tenant.slug}".`,
            errorCode: ErrorCode.InvalidRequestPayload
          });
        }

        const membership = await tx.tenantMember.upsert({
          where: {
            tenantId_userId: {
              tenantId: tenant.id,
              userId: user.id
            }
          },
          create: {
            tenantId: tenant.id,
            userId: user.id,
            role: payload.role as TenantMemberRole
          },
          update: {
            role: payload.role as TenantMemberRole
          }
        });

        const created = !existingMembership;
        const auditLogId = await this.superAdminAuditLogsService.createLog(
          {
            actorUserId,
            targetTenantId: tenant.id,
            action: SuperAdminAuditAction.UpsertTenantMember,
            metadata: {
              tenantSlug: tenant.slug,
              memberUserId: user.id,
              memberEmail: user.email,
              role: membership.role,
              previousRole: existingMembership?.role ?? null,
              created
            }
          },
          tx
        );

        return {
          user,
          membership,
          created,
          previousRole: existingMembership?.role ?? null,
          auditLogId
        };
      });
    } catch (error) {
      if (this.isTenantMemberUserConflict(error)) {
        throw new ConflictException({
          message: 'User is already bound to a tenant.',
          errorCode: ErrorCode.InvalidRequestPayload
        });
      }

      throw error;
    }

    return {
      tenantId: tenant.id,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name
      },
      role: result.membership.role,
      joinedAt: result.membership.createdAt.toISOString(),
      created: result.created,
      previousRole: result.previousRole,
      auditLogId: result.auditLogId
    };
  }

  async deleteTenantMember(
    actorUserId: string,
    tenantId: string,
    userId: string
  ): Promise<DeleteTenantMemberResponse> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          slug: true
        }
      });

      if (!tenant) {
        throw new NotFoundException({
          message: 'Tenant not found.',
          errorCode: ErrorCode.TenantNotFound
        });
      }

      const existingMembership = await tx.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId
          }
        }
      });

      if (!existingMembership) {
        throw new NotFoundException({
          message: 'Tenant member not found.',
          errorCode: ErrorCode.TenantMemberNotFound
        });
      }

      await tx.tenantMember.delete({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId
          }
        }
      });

      const auditLogId = await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: tenant.id,
          action: SuperAdminAuditAction.RemoveTenantMember,
          metadata: {
            tenantSlug: tenant.slug,
            memberUserId: userId,
            previousRole: existingMembership.role
          }
        },
        tx
      );

      return {
        tenantId: tenant.id,
        userId,
        removed: true,
        previousRole: existingMembership.role,
        auditLogId
      };
    });
  }

  async getActivityOverview(
    actorUserId: string,
    query: GetAdminActivityOverviewQuery
  ): Promise<AdminActivityOverviewResponse> {
    const generatedAt = new Date();
    const trendDays = query.window === '7d' ? 7 : 30;

    const todayStart = this.startOfUtcDay(generatedAt);
    const tomorrowStart = this.addDaysUtc(todayStart, 1);
    const mauStart = this.addDaysUtc(todayStart, -29);
    const wauStart = this.addDaysUtc(todayStart, -6);
    const activeTenants7dStart = wauStart;
    const retentionCurrentStart = wauStart;
    const retentionPrevStart = this.addDaysUtc(todayStart, -13);
    const retentionPrevEnd = this.addDaysUtc(todayStart, -6);
    const trendStart = this.addDaysUtc(todayStart, -(trendDays - 1));

    const auditRows = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: ACTIVITY_WRITE_ACTIONS
        },
        createdAt: {
          gte: retentionPrevStart,
          lt: tomorrowStart
        }
      },
      select: {
        createdAt: true,
        tenantId: true,
        actorUserId: true
      }
    });

    const usersDau = new Set<string>();
    const usersWau = new Set<string>();
    const usersMau = new Set<string>();
    const tenantsActive7d = new Set<string>();
    const retentionPrevTenants = new Set<string>();
    const retentionCurrentTenants = new Set<string>();

    const trendMap = new Map<string, { users: Set<string>; tenants: Set<string> }>();
    for (let i = 0; i < trendDays; i += 1) {
      const day = this.addDaysUtc(trendStart, i);
      trendMap.set(this.toDateKey(day), { users: new Set<string>(), tenants: new Set<string>() });
    }

    for (const row of auditRows) {
      const at = row.createdAt;
      const dateKey = this.toDateKey(at);

      if (at >= todayStart && at < tomorrowStart) {
        usersDau.add(row.actorUserId);
      }
      if (at >= wauStart && at < tomorrowStart) {
        usersWau.add(row.actorUserId);
      }
      if (at >= mauStart && at < tomorrowStart) {
        usersMau.add(row.actorUserId);
      }
      if (at >= activeTenants7dStart && at < tomorrowStart) {
        tenantsActive7d.add(row.tenantId);
      }
      if (at >= retentionPrevStart && at < retentionPrevEnd) {
        retentionPrevTenants.add(row.tenantId);
      }
      if (at >= retentionCurrentStart && at < tomorrowStart) {
        retentionCurrentTenants.add(row.tenantId);
      }

      const trendBucket = trendMap.get(dateKey);
      if (trendBucket) {
        trendBucket.users.add(row.actorUserId);
        trendBucket.tenants.add(row.tenantId);
      }
    }

    let retainedTenantCount = 0;
    for (const tenantId of retentionPrevTenants) {
      if (retentionCurrentTenants.has(tenantId)) {
        retainedTenantCount += 1;
      }
    }

    const tenantRetention7d =
      retentionPrevTenants.size === 0 ? 0 : retainedTenantCount / retentionPrevTenants.size;

    const response: AdminActivityOverviewResponse = {
      generatedAt: generatedAt.toISOString(),
      window: query.window,
      kpis: {
        dau: usersDau.size,
        wau: usersWau.size,
        mau: usersMau.size,
        activeTenants7d: tenantsActive7d.size,
        tenantRetention7d
      },
      trend: Array.from(trendMap.entries()).map(([date, bucket]) => ({
        date,
        dau: bucket.users.size,
        activeTenants: bucket.tenants.size
      })),
      definitions: {
        activeTenant: '7 天内发生至少 1 次写操作的租户。',
        tenantRetention7d: '前 7 天活跃租户中，在最近 7 天仍保持活跃的占比。'
      }
    };

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.GetActivityAnalyticsOverview,
      metadata: {
        window: query.window,
        dau: response.kpis.dau,
        wau: response.kpis.wau,
        mau: response.kpis.mau,
        activeTenants7d: response.kpis.activeTenants7d,
        tenantRetention7d: response.kpis.tenantRetention7d
      }
    });

    return response;
  }

  async getUsageOverview(
    actorUserId: string,
    query: GetAdminUsageOverviewQuery
  ): Promise<AdminUsageOverviewResponse> {
    const generatedAt = new Date();
    const tenantUsage = await this.buildTenantUsageSnapshots(generatedAt);
    const rankedTenants = [...tenantUsage]
      .sort(
        (left, right) =>
          right.usageScore - left.usageScore ||
          right.alerts.length - left.alerts.length ||
          left.tenantSlug.localeCompare(right.tenantSlug)
      )
      .slice(0, query.topN);

    const totalStorageBytes = tenantUsage.reduce(
      (sum, tenant) => sum + BigInt(tenant.usage.storageBytes.usedBytes),
      BigInt(0)
    );
    const totalProducts = tenantUsage.reduce((sum, tenant) => sum + tenant.usage.products.used, 0);
    const totalImages = tenantUsage.reduce((sum, tenant) => sum + tenant.usage.images.used, 0);
    const totalShares = tenantUsage.reduce((sum, tenant) => sum + tenant.usage.shares.used, 0);
    const nearLimitTenantCount = tenantUsage.filter((tenant) =>
      tenant.alerts.some((alert) => alert.status === 'near_limit')
    ).length;
    const exceededTenantCount = tenantUsage.filter((tenant) =>
      tenant.alerts.some((alert) => alert.status === 'exceeded')
    ).length;

    const response: AdminUsageOverviewResponse = {
      generatedAt: generatedAt.toISOString(),
      topN: query.topN,
      summary: {
        tenantCount: tenantUsage.length,
        totalProducts,
        totalImages,
        totalShares,
        totalStorageBytes: totalStorageBytes.toString(),
        nearLimitTenantCount,
        exceededTenantCount
      },
      topTenants: rankedTenants,
      definitions: {
        score:
          'Usage score is the highest utilization ratio among limited metrics (products/images/shares/storage).',
        nearLimit: `near_limit means utilization >= ${(USAGE_NEAR_LIMIT_RATIO * 100).toFixed(0)}% and <= 100%.`,
        exceeded: 'exceeded means used value is greater than configured limit.'
      }
    };

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.GetUsageOverview,
      metadata: {
        topN: query.topN,
        tenantCount: response.summary.tenantCount,
        nearLimitTenantCount: response.summary.nearLimitTenantCount,
        exceededTenantCount: response.summary.exceededTenantCount
      }
    });

    return response;
  }

  async getTenantUsage(
    actorUserId: string,
    tenantId: string
  ): Promise<GetAdminTenantUsageResponse> {
    const generatedAt = new Date();
    const tenantUsage = await this.buildTenantUsageSnapshots(generatedAt);
    const targetTenant = tenantUsage.find((item) => item.tenantId === tenantId);

    if (!targetTenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const response: GetAdminTenantUsageResponse = {
      generatedAt: generatedAt.toISOString(),
      tenant: targetTenant,
      definitions: {
        products:
          'Product limit follows maxShares override first; otherwise it uses the plan default baseline.',
        images:
          'Image limit is maxImages from tenant subscription; null means unlimited for this tenant.',
        shares:
          'Share limit uses maxShares from tenant subscription; null means unlimited for this tenant.',
        storageBytes:
          'Storage limit is maxStorageBytes from tenant subscription; null means unlimited for this tenant.',
        nearLimit: `near_limit means utilization >= ${(USAGE_NEAR_LIMIT_RATIO * 100).toFixed(0)}%.`,
        exceeded: 'exceeded means used value is greater than configured limit.'
      }
    };

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: targetTenant.tenantId,
      action: SuperAdminAuditAction.GetTenantUsage,
      metadata: {
        tenantSlug: targetTenant.tenantSlug,
        usageScore: targetTenant.usageScore,
        alerts: targetTenant.alerts.length
      }
    });

    return response;
  }

  async getRevenueOverview(
    actorUserId: string,
    query: GetAdminRevenueOverviewQuery
  ): Promise<AdminRevenueOverviewResponse> {
    const generatedAt = new Date();
    const trendDays = query.window === '90d' ? 90 : 30;
    const todayStart = this.startOfUtcDay(generatedAt);
    const tomorrowStart = this.addDaysUtc(todayStart, 1);
    const trendStart = this.addDaysUtc(todayStart, -(trendDays - 1));

    const [tenants, subscriptions, trendEvents] = await Promise.all([
      this.prisma.tenant.findMany({
        select: {
          id: true
        }
      }),
      this.prisma.tenantSubscription.findMany({
        select: {
          tenantId: true,
          plan: true,
          expiresAt: true,
          disabledAt: true
        }
      }),
      this.prisma.superAdminAuditLog.findMany({
        where: {
          action: {
            in: REVENUE_TREND_ACTIONS
          },
          createdAt: {
            gte: trendStart,
            lt: tomorrowStart
          }
        },
        select: {
          createdAt: true,
          action: true,
          targetTenantId: true,
          metadata: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    ]);

    const subscriptionMap = new Map(
      subscriptions.map((subscription) => [subscription.tenantId, subscription])
    );

    const planBreakdownMap: Record<
      TenantSubscriptionPlan,
      { plan: TenantSubscriptionPlan; activeTenantCount: number; payingTenantCount: number; mrrCents: number }
    > = {
      FREE: { plan: 'FREE', activeTenantCount: 0, payingTenantCount: 0, mrrCents: 0 },
      BASIC: { plan: 'BASIC', activeTenantCount: 0, payingTenantCount: 0, mrrCents: 0 },
      PRO: { plan: 'PRO', activeTenantCount: 0, payingTenantCount: 0, mrrCents: 0 }
    };

    let activeTenantCount = 0;
    let payingTenantCount = 0;
    let mrrCents = 0;

    for (const tenant of tenants) {
      const subscription = subscriptionMap.get(tenant.id);
      const plan = subscription?.plan ?? TenantSubscriptionPlan.FREE;
      const status = this.resolveSubscriptionStatus(
        subscription?.expiresAt ?? null,
        subscription?.disabledAt ?? null,
        generatedAt
      );
      if (status !== 'ACTIVE') {
        continue;
      }

      const planPrice = PLAN_MONTHLY_PRICE_CENTS[plan];
      activeTenantCount += 1;
      planBreakdownMap[plan].activeTenantCount += 1;

      if (planPrice > 0) {
        payingTenantCount += 1;
        mrrCents += planPrice;
        planBreakdownMap[plan].payingTenantCount += 1;
        planBreakdownMap[plan].mrrCents += planPrice;
      }
    }

    const trendMap = new Map<
      string,
      { upgrades: number; downgrades: number; churns: number; reactivations: number }
    >();
    for (let i = 0; i < trendDays; i += 1) {
      const day = this.addDaysUtc(trendStart, i);
      trendMap.set(this.toDateKey(day), {
        upgrades: 0,
        downgrades: 0,
        churns: 0,
        reactivations: 0
      });
    }

    const latestPlanByTenant = new Map<string, TenantSubscriptionPlan>();
    let upgradeEvents = 0;
    let downgradeEvents = 0;
    let churnEvents = 0;
    let reactivationEvents = 0;

    for (const event of trendEvents) {
      const dayKey = this.toDateKey(event.createdAt);
      const bucket = trendMap.get(dayKey);
      if (!bucket) {
        continue;
      }

      if (event.action === SuperAdminAuditAction.UpdateTenantSubscription) {
        const nextPlan = this.extractPlanFromAuditMetadata(event.metadata);
        if (!nextPlan || !event.targetTenantId) {
          continue;
        }

        const previousPlan = latestPlanByTenant.get(event.targetTenantId);
        if (previousPlan) {
          if (PLAN_LEVEL[nextPlan] > PLAN_LEVEL[previousPlan]) {
            bucket.upgrades += 1;
            upgradeEvents += 1;
          } else if (PLAN_LEVEL[nextPlan] < PLAN_LEVEL[previousPlan]) {
            bucket.downgrades += 1;
            downgradeEvents += 1;
          }
        }

        latestPlanByTenant.set(event.targetTenantId, nextPlan);
        continue;
      }

      if (
        event.action === SuperAdminAuditAction.SuspendTenantLifecycle ||
        event.action === SuperAdminAuditAction.OffboardTenantLifecycle
      ) {
        bucket.churns += 1;
        churnEvents += 1;
        continue;
      }

      if (event.action === SuperAdminAuditAction.ReactivateTenantLifecycle) {
        bucket.reactivations += 1;
        reactivationEvents += 1;
      }
    }

    const response: AdminRevenueOverviewResponse = {
      generatedAt: generatedAt.toISOString(),
      window: query.window,
      kpis: {
        activeTenantCount,
        payingTenantCount,
        mrrCents,
        arrCents: mrrCents * 12,
        upgradeEvents,
        downgradeEvents,
        churnEvents,
        reactivationEvents
      },
      planBreakdown: [planBreakdownMap.FREE, planBreakdownMap.BASIC, planBreakdownMap.PRO],
      trend: Array.from(trendMap.entries()).map(([date, value]) => ({
        date,
        upgrades: value.upgrades,
        downgrades: value.downgrades,
        churns: value.churns,
        reactivations: value.reactivations
      })),
      priceBookMonthlyCents: PLAN_MONTHLY_PRICE_CENTS,
      definitions: {
        mrr: 'MRR is estimated from ACTIVE tenant subscriptions multiplied by plan monthly price mapping.',
        arr: 'ARR is computed as MRR * 12.',
        trend:
          'Trend uses super-admin lifecycle/subscription audit events; upgrade/downgrade are inferred from consecutive plan update events.'
      }
    };

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.GetRevenueOverview,
      metadata: {
        window: query.window,
        mrrCents: response.kpis.mrrCents,
        payingTenantCount: response.kpis.payingTenantCount,
        upgradeEvents: response.kpis.upgradeEvents,
        downgradeEvents: response.kpis.downgradeEvents,
        churnEvents: response.kpis.churnEvents,
        reactivationEvents: response.kpis.reactivationEvents
      }
    });

    return response;
  }

  async listAuditLogs(
    actorUserId: string,
    query: ListSuperAdminAuditLogsQuery
  ): Promise<ListSuperAdminAuditLogsResponse> {
    const response = await this.superAdminAuditLogsService.listLogs(query);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: query.tenantId ?? null,
      action: SuperAdminAuditAction.ListAuditLogs,
      metadata: {
        tenantFilter: query.tenantId ?? null,
        actorUserId: query.actorUserId ?? null,
        action: query.action ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        page: query.page,
        pageSize: query.pageSize,
        resultCount: response.logs.length
      }
    });

    return response;
  }

  async exportAuditLogs(actorUserId: string, query: ExportSuperAdminAuditLogsQuery) {
    const range = this.getAuditExportRangeOrThrow(query);
    const response = await this.superAdminAuditLogsService.listLogsForExport(query);

    if (response.truncated) {
      throw new BadRequestException({
        message: `Export matches more than ${query.limit} rows. Narrow the time range or add more filters and retry.`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const csv = this.toAuditLogsCsv(response.logs);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: query.tenantId ?? null,
      action: SuperAdminAuditAction.ExportAuditLogs,
      metadata: {
        tenantFilter: query.tenantId ?? null,
        actorUserId: query.actorUserId ?? null,
        action: query.action ?? null,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        limit: query.limit,
        resultCount: response.logs.length,
        truncated: false
      }
    });

    return {
      csv,
      rowCount: response.logs.length,
      truncated: false
    };
  }

  private async buildTenantUsageSnapshots(now: Date): Promise<AdminTenantUsage[]> {
    const [tenants, subscriptions, productCounts, imageStats, shareCounts] = await Promise.all([
      this.prisma.tenant.findMany({
        select: {
          id: true,
          slug: true,
          name: true
        }
      }),
      this.prisma.tenantSubscription.findMany({
        select: {
          tenantId: true,
          plan: true,
          expiresAt: true,
          disabledAt: true,
          maxImages: true,
          maxStorageBytes: true,
          maxShares: true
        }
      }),
      this.prisma.product.groupBy({
        by: ['tenantId'],
        _count: {
          _all: true
        }
      }),
      this.prisma.productImage.groupBy({
        by: ['tenantId'],
        _count: {
          _all: true
        },
        _sum: {
          sizeBytes: true
        }
      }),
      this.prisma.publicShare.groupBy({
        by: ['tenantId'],
        _count: {
          _all: true
        }
      })
    ]);

    const subscriptionMap = new Map(
      subscriptions.map((subscription) => [subscription.tenantId, subscription])
    );
    const productMap = new Map(productCounts.map((row) => [row.tenantId, row._count._all]));
    const imageCountMap = new Map(imageStats.map((row) => [row.tenantId, row._count._all]));
    const imageStorageMap = new Map(
      imageStats.map((row) => [row.tenantId, row._sum.sizeBytes ?? BigInt(0)])
    );
    const shareMap = new Map(shareCounts.map((row) => [row.tenantId, row._count._all]));

    return tenants.map((tenant) => {
      const subscription = subscriptionMap.get(tenant.id);
      const plan = subscription?.plan ?? TenantSubscriptionPlan.FREE;
      const subscriptionStatus = this.resolveSubscriptionStatus(
        subscription?.expiresAt ?? null,
        subscription?.disabledAt ?? null,
        now
      );
      const defaultLimits = DEFAULT_USAGE_LIMITS[plan];
      const productLimit = subscription?.maxShares ?? defaultLimits.products;
      const imageLimit = subscription?.maxImages ?? null;
      const shareLimit = subscription?.maxShares ?? null;
      const storageLimit = subscription?.maxStorageBytes ?? null;

      const productsUsed = productMap.get(tenant.id) ?? 0;
      const imagesUsed = imageCountMap.get(tenant.id) ?? 0;
      const sharesUsed = shareMap.get(tenant.id) ?? 0;
      const storageUsed = imageStorageMap.get(tenant.id) ?? BigInt(0);

      const productsMetric = this.toCountUsageMetric(productsUsed, productLimit);
      const imagesMetric = this.toCountUsageMetric(imagesUsed, imageLimit);
      const sharesMetric = this.toCountUsageMetric(sharesUsed, shareLimit);
      const storageMetric = this.toStorageUsageMetric(storageUsed, storageLimit);

      const alerts = this.buildUsageAlerts(productsMetric, imagesMetric, sharesMetric, storageMetric);

      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        plan,
        subscriptionStatus,
        usage: {
          products: productsMetric,
          images: imagesMetric,
          shares: sharesMetric,
          storageBytes: storageMetric
        },
        alerts,
        usageScore: this.computeUsageScore(productsMetric, imagesMetric, sharesMetric, storageMetric)
      };
    });
  }

  private toCountUsageMetric(used: number, limit: number | null): UsageCounterMetric {
    if (limit === null) {
      return {
        used,
        limit: null,
        utilization: null,
        status: 'unlimited'
      };
    }

    const utilization = limit <= 0 ? (used > 0 ? Number.POSITIVE_INFINITY : 0) : used / limit;
    const status =
      used > limit ? 'exceeded' : utilization >= USAGE_NEAR_LIMIT_RATIO ? 'near_limit' : 'ok';

    return {
      used,
      limit,
      utilization: Number.isFinite(utilization) ? utilization : null,
      status
    };
  }

  private toStorageUsageMetric(usedBytes: bigint, limitBytes: bigint | null): UsageStorageMetric {
    if (limitBytes === null) {
      return {
        usedBytes: usedBytes.toString(),
        limitBytes: null,
        utilization: null,
        status: 'unlimited'
      };
    }

    const utilization = limitBytes <= BigInt(0) ? (usedBytes > BigInt(0) ? Infinity : 0) : Number(usedBytes) / Number(limitBytes);
    const status =
      usedBytes > limitBytes ? 'exceeded' : utilization >= USAGE_NEAR_LIMIT_RATIO ? 'near_limit' : 'ok';

    return {
      usedBytes: usedBytes.toString(),
      limitBytes: limitBytes.toString(),
      utilization: Number.isFinite(utilization) ? utilization : null,
      status
    };
  }

  private buildUsageAlerts(
    products: UsageCounterMetric,
    images: UsageCounterMetric,
    shares: UsageCounterMetric,
    storageBytes: UsageStorageMetric
  ): AdminTenantUsage['alerts'] {
    const alerts: AdminTenantUsage['alerts'] = [];
    const usageEntries: Array<{
      metric: 'products' | 'images' | 'shares' | 'storageBytes';
      status: UsageCounterMetric['status'] | UsageStorageMetric['status'];
    }> = [
      { metric: 'products', status: products.status },
      { metric: 'images', status: images.status },
      { metric: 'shares', status: shares.status },
      { metric: 'storageBytes', status: storageBytes.status }
    ];

    for (const entry of usageEntries) {
      if (entry.status !== 'near_limit' && entry.status !== 'exceeded') {
        continue;
      }

      alerts.push({
        metric: entry.metric,
        status: entry.status,
        message:
          entry.status === 'exceeded'
            ? `${entry.metric} exceeds the configured limit.`
            : `${entry.metric} is approaching the configured limit.`
      });
    }

    return alerts;
  }

  private computeUsageScore(
    products: UsageCounterMetric,
    images: UsageCounterMetric,
    shares: UsageCounterMetric,
    storageBytes: UsageStorageMetric
  ): number {
    const ratios = [products.utilization, images.utilization, shares.utilization, storageBytes.utilization]
      .filter((value): value is number => value !== null)
      .map((value) => Math.max(0, value));

    if (ratios.length === 0) {
      return 0;
    }

    const maxRatio = Math.max(...ratios);
    return Math.round(maxRatio * 10000) / 100;
  }

  private extractPlanFromAuditMetadata(metadata: Prisma.JsonValue | null): TenantSubscriptionPlan | null {
    const root = this.asJsonObject(metadata);
    if (!root) {
      return null;
    }

    const directPlan = this.toSubscriptionPlan(root.plan);
    if (directPlan) {
      return directPlan;
    }

    const subscriptionPlan = this.toSubscriptionPlan(this.asJsonObject(root.subscription)?.plan);
    if (subscriptionPlan) {
      return subscriptionPlan;
    }

    return this.toSubscriptionPlan(this.asJsonObject(root.payload)?.plan);
  }

  private asJsonObject(
    value: Prisma.JsonValue | undefined | null
  ): Record<string, Prisma.JsonValue> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, Prisma.JsonValue>;
  }

  private toSubscriptionPlan(value: Prisma.JsonValue | undefined): TenantSubscriptionPlan | null {
    if (typeof value !== 'string') {
      return null;
    }

    if (
      value === TenantSubscriptionPlan.FREE ||
      value === TenantSubscriptionPlan.BASIC ||
      value === TenantSubscriptionPlan.PRO
    ) {
      return value;
    }

    return null;
  }

  private resolveSubscriptionStatus(
    expiresAt: Date | null,
    disabledAt: Date | null,
    now: Date
  ): 'ACTIVE' | 'DISABLED' | 'EXPIRED' {
    if (disabledAt) {
      return 'DISABLED';
    }

    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }

  private getAuditExportRangeOrThrow(query: ExportSuperAdminAuditLogsQuery): { from: Date; to: Date } {
    if (!query.from || !query.to) {
      throw new BadRequestException({
        message: 'Audit export requires both `from` and `to` parameters.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'Audit export `from` and `to` must be valid ISO datetime strings.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (to.getTime() < from.getTime()) {
      throw new BadRequestException({
        message: 'Audit export `to` must be greater than or equal to `from`.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (to.getTime() - from.getTime() > AUDIT_EXPORT_MAX_RANGE_MS) {
      throw new BadRequestException({
        message: `Audit export time range cannot exceed ${AUDIT_EXPORT_MAX_RANGE_DAYS} days.`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    return {
      from,
      to
    };
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private startOfUtcDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private addDaysUtc(value: Date, days: number) {
    return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private toAuditLogsCsv(logs: ListSuperAdminAuditLogsResponse['logs']) {
    const header = [
      'id',
      'createdAt',
      'action',
      'actorUserEmail',
      'actorUserId',
      'targetTenantSlug',
      'targetTenantId'
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt,
      log.action,
      log.actorUserEmail ?? '',
      log.actorUserId,
      log.targetTenantSlug ?? '',
      log.targetTenantId ?? ''
    ]);

    return [header, ...rows].map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\n');
  }

  private escapeCsvCell(value: string) {
    const escaped = value.replaceAll('"', '""');
    return `"${escaped}"`;
  }

  private isTenantSlugConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('slug');
  }

  private isTenantMemberUserConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    const normalized = new Set(target.map((value) => String(value)));

    return (
      normalized.has('userId') ||
      normalized.has('user_id') ||
      normalized.has('tenant_members_user_id_key')
    );
  }
}
