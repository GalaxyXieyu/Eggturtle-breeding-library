import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ErrorCode, SuperAdminAuditAction } from '@eggturtle/shared';
import type {
  CreateAdminTenantRequest,
  CreateAdminTenantResponse,
  CreateTenantSubscriptionActivationCodeRequest,
  CreateTenantSubscriptionActivationCodeResponse,
  DeleteTenantMemberResponse,
  GetAdminTenantInsightsResponse,
  GetAdminTenantResponse,
  GetAdminTenantSubscriptionResponse,
  ListAdminTenantMembersQuery,
  ListAdminTenantMembersResponse,
  ListAdminTenantsQuery,
  ListAdminTenantsResponse,
  ListAdminUsersResponse,
  OffboardAdminTenantRequest,
  OffboardAdminTenantResponse,
  ReactivateAdminTenantResponse,
  SuspendAdminTenantRequest,
  SuspendAdminTenantResponse,
  UpdateTenantSubscriptionRequest,
  UpdateTenantSubscriptionResponse,
  UpsertTenantMemberRequest,
  UpsertTenantMemberResponse,
  AdminTenantAutoTag,
  AdminTenantUsage,
  AuditActionType
} from '@eggturtle/shared';
import { Prisma, TenantMemberRole, TenantSubscriptionPlan, type AuditLog as PrismaAuditLog } from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

const tenantDirectorySelect = {
  id: true,
  slug: true,
  name: true,
  createdAt: true,
  _count: {
    select: {
      members: true
    }
  },
  members: {
    where: {
      role: TenantMemberRole.OWNER
    },
    take: 1,
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          account: true,
          name: true,
          phoneBinding: {
            select: {
              phoneNumber: true
            }
          }
        }
      }
    }
  },
  subscription: {
    select: {
      plan: true,
      expiresAt: true,
      disabledAt: true
    }
  }
} satisfies Prisma.TenantSelect;

type TenantDirectoryRow = Prisma.TenantGetPayload<{
  select: typeof tenantDirectorySelect;
}>;

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

type TenantInsightSnapshot = {
  tenant: GetAdminTenantResponse['tenant'];
  autoTags: AdminTenantAutoTag[];
  loginMetrics: GetAdminTenantInsightsResponse['insights']['loginMetrics'];
  businessMetrics: GetAdminTenantInsightsResponse['insights']['businessMetrics'];
  usage: AdminTenantUsage;
};

const USAGE_NEAR_LIMIT_RATIO = 0.8;
const STORAGE_HIGH_WATERMARK_BYTES = BigInt(5 * 1024 * 1024 * 1024);
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

const RECENT_LOG_EXCLUDED_ACTIONS = new Set<AuditActionType>([
  AuditAction.ShareAccess,
  AuditAction.AuthLogin
]);
const UPLOAD_ACTIONS = new Set<AuditActionType>([
  AuditAction.ProductImageUpload,
  AuditAction.SaleSubjectMediaUpload
]);
const BUSINESS_ACTIVITY_ACTIONS = (Object.values(AuditAction) as AuditActionType[]).filter(
  (action) => action !== AuditAction.ShareAccess && action !== AuditAction.AuthLogin
);

@Injectable()
export class AdminTenantsService {
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
      where: this.buildTenantListWhere(query.search),
      orderBy: {
        createdAt: 'desc'
      },
      select: tenantDirectorySelect
    });

    const insightMap = await this.buildTenantInsightSnapshotMap(tenants, new Date());

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.ListTenants,
      metadata: {
        search: query.search ?? null,
        resultCount: tenants.length
      }
    });

    return {
      tenants: tenants.map((tenant) => insightMap.get(tenant.id)?.tenant ?? this.toAdminTenantSummary(tenant))
    };
  }

  async getTenant(actorUserId: string, tenantId: string): Promise<GetAdminTenantResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: tenantDirectorySelect
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const insightMap = await this.buildTenantInsightSnapshotMap([tenant], new Date());

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
      tenant: insightMap.get(tenant.id)?.tenant ?? this.toAdminTenantSummary(tenant)
    };
  }

  async getTenantInsights(
    actorUserId: string,
    tenantId: string
  ): Promise<GetAdminTenantInsightsResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: tenantDirectorySelect
    });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const insightMap = await this.buildTenantInsightSnapshotMap([tenant], new Date());
    const snapshot = insightMap.get(tenant.id);

    if (!snapshot) {
      throw new NotFoundException({
        message: 'Tenant insights not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const recentBusinessLogs = await this.listRecentBusinessLogs(tenant.id);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: tenant.id,
      action: SuperAdminAuditAction.ListTenants,
      metadata: {
        mode: 'insights',
        tenantSlug: tenant.slug,
        recentBusinessLogCount: recentBusinessLogs.length
      }
    });

    return {
      insights: {
        tenant: snapshot.tenant,
        autoTags: snapshot.autoTags,
        loginMetrics: snapshot.loginMetrics,
        businessMetrics: snapshot.businessMetrics,
        usage: snapshot.usage,
        recentBusinessLogs
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
          lastLoginAt: null,
          lastBusinessActivityAt: null,
          lastActiveAt: null,
          memberCount: 0,
          owner: null,
          subscription: null,
          autoTags: []
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
        account: this.resolveUserAccount(user),
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
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
          account: this.resolveUserAccount(member.user),
          name: member.user.name,
          isSuperAdmin: member.user.isSuperAdmin
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
      user: {
        id: string;
        email: string;
        account: string | null;
        name: string | null;
        isSuperAdmin: boolean;
      };
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
        account: this.resolveUserAccount(result.user),
        name: result.user.name,
        isSuperAdmin: result.user.isSuperAdmin
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


  private async buildTenantInsightSnapshotMap(
    tenants: TenantDirectoryRow[],
    now: Date
  ): Promise<Map<string, TenantInsightSnapshot>> {
    const tenantIds = tenants.map((tenant) => tenant.id);
    if (tenantIds.length === 0) {
      return new Map();
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [usageMap, loginTotals, recentLoginCounts, businessLastSeen, recentBusinessRows] = await Promise.all([
      this.buildTenantUsageSnapshotMap(tenants, now),
      this.prisma.auditLog.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: {
            in: tenantIds
          },
          action: AuditAction.AuthLogin
        },
        _count: {
          _all: true
        },
        _max: {
          createdAt: true
        }
      }),
      this.prisma.auditLog.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: {
            in: tenantIds
          },
          action: AuditAction.AuthLogin,
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.auditLog.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: {
            in: tenantIds
          },
          action: {
            in: BUSINESS_ACTIVITY_ACTIONS
          }
        },
        _max: {
          createdAt: true
        }
      }),
      this.prisma.auditLog.findMany({
        where: {
          tenantId: {
            in: tenantIds
          },
          createdAt: {
            gte: thirtyDaysAgo
          },
          action: {
            in: BUSINESS_ACTIVITY_ACTIONS
          }
        },
        select: {
          tenantId: true,
          action: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    const loginTotalMap = new Map(
      loginTotals.map((row) => [
        row.tenantId,
        {
          totalLogins: row._count._all,
          lastLoginAt: row._max.createdAt?.toISOString() ?? null
        }
      ])
    );
    const recentLoginMap = new Map(recentLoginCounts.map((row) => [row.tenantId, row._count._all]));
    const businessLastSeenMap = new Map(
      businessLastSeen.map((row) => [row.tenantId, row._max.createdAt?.toISOString() ?? null])
    );
    const recentBusinessMap = new Map<string, Array<{ action: AuditActionType; createdAt: Date }>>();

    for (const row of recentBusinessRows) {
      const items = recentBusinessMap.get(row.tenantId) ?? [];
      items.push({
        action: row.action as AuditActionType,
        createdAt: row.createdAt
      });
      recentBusinessMap.set(row.tenantId, items);
    }

    const snapshots = new Map<string, TenantInsightSnapshot>();
    for (const tenant of tenants) {
      const usage = usageMap.get(tenant.id) ?? this.createEmptyUsageSnapshot(tenant, now);
      const loginSummary = loginTotalMap.get(tenant.id);
      const recentBusiness = recentBusinessMap.get(tenant.id) ?? [];
      const activeDayKeys = new Set(recentBusiness.map((item) => this.toDateKey(item.createdAt)));
      const uploads30d = recentBusiness.filter((item) => UPLOAD_ACTIONS.has(item.action)).length;
      const loginMetrics = {
        totalLogins: loginSummary?.totalLogins ?? 0,
        logins30d: recentLoginMap.get(tenant.id) ?? 0,
        lastLoginAt: loginSummary?.lastLoginAt ?? null
      };
      const businessMetrics = {
        activeDays30d: activeDayKeys.size,
        lastBusinessActivityAt: businessLastSeenMap.get(tenant.id) ?? null,
        totalProducts: usage.usage.products.used,
        totalImages: usage.usage.images.used,
        totalShares: usage.usage.shares.used,
        uploads30d
      };
      const baseTenant = this.toAdminTenantSummary(tenant, [], {
        lastLoginAt: loginMetrics.lastLoginAt,
        lastBusinessActivityAt: businessMetrics.lastBusinessActivityAt
      });
      const autoTags = this.buildAutoTags({
        tenant: baseTenant,
        loginMetrics,
        businessMetrics,
        usage,
        now
      });
      snapshots.set(tenant.id, {
        tenant: {
          ...baseTenant,
          autoTags
        },
        autoTags,
        loginMetrics,
        businessMetrics,
        usage
      });
    }

    return snapshots;
  }

  private async buildTenantUsageSnapshotMap(
    tenants: TenantDirectoryRow[],
    now: Date
  ): Promise<Map<string, AdminTenantUsage>> {
    const tenantIds = tenants.map((tenant) => tenant.id);
    const [subscriptions, productCounts, imageStats, shareCounts] = await Promise.all([
      this.prisma.tenantSubscription.findMany({
        where: {
          tenantId: {
            in: tenantIds
          }
        },
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
        where: {
          tenantId: {
            in: tenantIds
          }
        },
        _count: {
          _all: true
        }
      }),
      this.prisma.productImage.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: {
            in: tenantIds
          }
        },
        _count: {
          _all: true
        },
        _sum: {
          sizeBytes: true
        }
      }),
      this.prisma.publicShare.groupBy({
        by: ['tenantId'],
        where: {
          tenantId: {
            in: tenantIds
          }
        },
        _count: {
          _all: true
        }
      })
    ]);

    const subscriptionMap = new Map(subscriptions.map((subscription) => [subscription.tenantId, subscription]));
    const productMap = new Map(productCounts.map((row) => [row.tenantId, row._count._all]));
    const imageCountMap = new Map(imageStats.map((row) => [row.tenantId, row._count._all]));
    const imageStorageMap = new Map(imageStats.map((row) => [row.tenantId, row._sum.sizeBytes ?? BigInt(0)]));
    const shareMap = new Map(shareCounts.map((row) => [row.tenantId, row._count._all]));
    const result = new Map<string, AdminTenantUsage>();

    for (const tenant of tenants) {
      const subscription = subscriptionMap.get(tenant.id);
      const plan = subscription?.plan ?? TenantSubscriptionPlan.FREE;
      const subscriptionStatus = this.resolveTenantSubscriptionStatus(
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
      result.set(tenant.id, {
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
        alerts: this.buildUsageAlerts(productsMetric, imagesMetric, sharesMetric, storageMetric),
        usageScore: this.computeUsageScore(productsMetric, imagesMetric, sharesMetric, storageMetric)
      });
    }

    return result;
  }

  private createEmptyUsageSnapshot(tenant: TenantDirectoryRow, now: Date): AdminTenantUsage {
    const plan = tenant.subscription?.plan ?? TenantSubscriptionPlan.FREE;
    const defaultLimits = DEFAULT_USAGE_LIMITS[plan];
    const subscriptionStatus = this.resolveTenantSubscriptionStatus(
      tenant.subscription?.expiresAt ?? null,
      tenant.subscription?.disabledAt ?? null,
      now
    );
    const productsMetric = this.toCountUsageMetric(0, defaultLimits.products);
    const imagesMetric = this.toCountUsageMetric(0, defaultLimits.images);
    const sharesMetric = this.toCountUsageMetric(0, defaultLimits.shares);
    const storageMetric = this.toStorageUsageMetric(BigInt(0), defaultLimits.storageBytes);

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
      alerts: [],
      usageScore: 0
    };
  }

  private async listRecentBusinessLogs(tenantId: string, take = 20) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: {
          notIn: Array.from(RECENT_LOG_EXCLUDED_ACTIONS)
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take
    });

    return logs.map((log) => this.toAuditLog(log));
  }

  private toAuditLog(log: PrismaAuditLog) {
    return {
      id: log.id,
      tenantId: log.tenantId,
      actorUserId: log.actorUserId,
      action: log.action as AuditActionType,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    };
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
    const status = used > limit ? 'exceeded' : utilization >= USAGE_NEAR_LIMIT_RATIO ? 'near_limit' : 'ok';

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

    const utilization =
      limitBytes <= BigInt(0) ? (usedBytes > BigInt(0) ? Infinity : 0) : Number(usedBytes) / Number(limitBytes);
    const status = usedBytes > limitBytes ? 'exceeded' : utilization >= USAGE_NEAR_LIMIT_RATIO ? 'near_limit' : 'ok';

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
    const entries: Array<{
      metric: 'products' | 'images' | 'shares' | 'storageBytes';
      status: UsageCounterMetric['status'] | UsageStorageMetric['status'];
    }> = [
      { metric: 'products', status: products.status },
      { metric: 'images', status: images.status },
      { metric: 'shares', status: shares.status },
      { metric: 'storageBytes', status: storageBytes.status }
    ];

    for (const entry of entries) {
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
  ) {
    const ratios = [products.utilization, images.utilization, shares.utilization, storageBytes.utilization]
      .filter((value): value is number => value !== null)
      .map((value) => Math.max(0, value));

    if (ratios.length === 0) {
      return 0;
    }

    const maxRatio = Math.max(...ratios);
    return Math.round(maxRatio * 10000) / 100;
  }

  private buildTenantListWhere(search?: string): Prisma.TenantWhereInput | undefined {
    if (!search) {
      return undefined;
    }

    return {
      OR: [
        {
          slug: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          members: {
            some: {
              role: TenantMemberRole.OWNER,
              user: {
                OR: [
                  {
                    email: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
                  {
                    account: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
                  {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  },
                  {
                    phoneBinding: {
                      is: {
                        phoneNumber: {
                          contains: search,
                          mode: 'insensitive'
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ]
    };
  }

  private toAdminTenantSummary(
    tenant: TenantDirectoryRow,
    autoTags: AdminTenantAutoTag[] = [],
    activity: {
      lastLoginAt?: string | null;
      lastBusinessActivityAt?: string | null;
    } = {}
  ): GetAdminTenantResponse['tenant'] {
    const ownerMembership = tenant.members[0];
    const owner = ownerMembership
      ? {
          id: ownerMembership.user.id,
          email: ownerMembership.user.email,
          account: this.resolveUserAccount(ownerMembership.user),
          name: ownerMembership.user.name,
          phone: ownerMembership.user.phoneBinding?.phoneNumber ?? null
        }
      : null;

    const subscription = tenant.subscription
      ? {
          plan: tenant.subscription.plan,
          status: this.resolveTenantSubscriptionStatus(
            tenant.subscription.expiresAt,
            tenant.subscription.disabledAt
          ),
          expiresAt: tenant.subscription.expiresAt?.toISOString() ?? null
        }
      : {
          plan: 'FREE' as const,
          status: 'ACTIVE' as const,
          expiresAt: null
        };
    const lastLoginAt = activity.lastLoginAt ?? null;
    const lastBusinessActivityAt = activity.lastBusinessActivityAt ?? null;

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      createdAt: tenant.createdAt.toISOString(),
      lastLoginAt,
      lastBusinessActivityAt,
      lastActiveAt: this.resolveLastActiveAt(lastLoginAt, lastBusinessActivityAt),
      memberCount: tenant._count.members,
      owner,
      subscription,
      autoTags
    };
  }

  private resolveLastActiveAt(lastLoginAt: string | null, lastBusinessActivityAt: string | null) {
    if (!lastLoginAt) {
      return lastBusinessActivityAt;
    }

    if (!lastBusinessActivityAt) {
      return lastLoginAt;
    }

    return Date.parse(lastLoginAt) >= Date.parse(lastBusinessActivityAt) ? lastLoginAt : lastBusinessActivityAt;
  }

  private buildAutoTags(input: {
    tenant: GetAdminTenantResponse['tenant'];
    loginMetrics: GetAdminTenantInsightsResponse['insights']['loginMetrics'];
    businessMetrics: GetAdminTenantInsightsResponse['insights']['businessMetrics'];
    usage: AdminTenantUsage;
    now: Date;
  }): AdminTenantAutoTag[] {
    const { tenant, loginMetrics, businessMetrics, usage, now } = input;
    const tags: AdminTenantAutoTag[] = [];
    const expiresAt = tenant.subscription?.expiresAt ? new Date(tenant.subscription.expiresAt) : null;
    const isExpiringSoon =
      tenant.subscription?.status === 'ACTIVE' &&
      expiresAt !== null &&
      expiresAt.getTime() > now.getTime() &&
      expiresAt.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000;
    const isSilent = loginMetrics.logins30d === 0 && businessMetrics.activeDays30d === 0;
    const isHighActivity = loginMetrics.logins30d >= 6 && businessMetrics.activeDays30d >= 4;
    const isLowActivity = !isSilent && loginMetrics.logins30d <= 2 && businessMetrics.activeDays30d <= 2;
    const storageUtilization = usage.usage.storageBytes.utilization;
    const storageUsed = BigInt(usage.usage.storageBytes.usedBytes);

    if (tenant.subscription?.status === 'DISABLED') {
      tags.push({
        key: 'frozen',
        label: '已冻结',
        description: '订阅已被后台禁用，需要先恢复后再继续使用。',
        tone: 'danger',
        priority: 100
      });
    }

    if (isExpiringSoon) {
      tags.push({
        key: 'expiring_soon',
        label: '即将到期',
        description: '订阅将在 7 天内到期，建议提前续费或调整方案。',
        tone: 'warning',
        priority: 95
      });
    }

    if (!tenant.owner) {
      tags.push({
        key: 'no_owner',
        label: '无 Owner',
        description: '当前用户空间未识别到 OWNER 成员，需要补齐主负责人。',
        tone: 'danger',
        priority: 92
      });
    }

    if (isSilent) {
      tags.push({
        key: 'silent',
        label: '沉默中',
        description: '最近 30 天无登录且无业务写操作。',
        tone: 'neutral',
        priority: 88
      });
    } else if (isLowActivity) {
      tags.push({
        key: 'low_activity',
        label: '低活跃',
        description: '最近 30 天登录和业务操作都偏少，建议重点回访。',
        tone: 'warning',
        priority: 74
      });
    } else if (isHighActivity) {
      tags.push({
        key: 'high_activity',
        label: '高活跃',
        description: '最近 30 天登录和业务写操作均保持高频。',
        tone: 'success',
        priority: 70
      });
    }

    if (tenant.memberCount >= 2) {
      tags.push({
        key: 'collaborative',
        label: '多人协作',
        description: '成员数达到 2 人及以上，属于多人协作空间。',
        tone: 'info',
        priority: 58
      });
    }

    if (businessMetrics.uploads30d >= 12) {
      tags.push({
        key: 'high_upload',
        label: '高上传',
        description: '最近 30 天上传行为频繁，内容生产活跃。',
        tone: 'info',
        priority: 54
      });
    }

    if (businessMetrics.totalShares >= 10) {
      tags.push({
        key: 'high_share',
        label: '高分享',
        description: '分享总量较高，存在明显的对外传播需求。',
        tone: 'accent',
        priority: 50
      });
    }

    if ((storageUtilization !== null && storageUtilization >= 0.7) || storageUsed >= STORAGE_HIGH_WATERMARK_BYTES) {
      tags.push({
        key: 'high_storage',
        label: '高存储',
        description: '存储利用率较高，建议持续关注容量和成本。',
        tone: 'warning',
        priority: 52
      });
    }

    return tags.sort((left, right) => right.priority - left.priority);
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private resolveTenantSubscriptionStatus(
    expiresAt: Date | null,
    disabledAt: Date | null,
    now = new Date()
  ): 'ACTIVE' | 'DISABLED' | 'EXPIRED' {
    if (disabledAt) {
      return 'DISABLED';
    }

    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return 'EXPIRED';
    }

    return 'ACTIVE';
  }
  private normalizeValidAccount(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    return /^[a-z][a-z0-9_-]{2,30}[a-z0-9]$/.test(normalized) ? normalized : null;
  }

  private resolveUserAccount(user: {
    email: string;
    account?: string | null;
  }): string | null {
    const directAccount = this.normalizeValidAccount(user.account);
    if (directAccount) {
      return directAccount;
    }

    const legacyMatch = user.email.match(/^([^@]+)@account\.eggturtle\.local$/i);
    if (legacyMatch) {
      return this.normalizeValidAccount(legacyMatch[1]);
    }

    return null;
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
