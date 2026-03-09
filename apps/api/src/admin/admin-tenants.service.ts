import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, SuperAdminAuditAction } from '@eggturtle/shared';
import type {
  CreateAdminTenantRequest,
  CreateAdminTenantResponse,
  CreateTenantSubscriptionActivationCodeRequest,
  CreateTenantSubscriptionActivationCodeResponse,
  DeleteTenantMemberResponse,
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
  UpsertTenantMemberResponse
} from '@eggturtle/shared';
import { Prisma, TenantMemberRole } from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

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
              },
              {
                members: {
                  some: {
                    role: TenantMemberRole.OWNER,
                    user: {
                      OR: [
                        {
                          account: {
                            contains: query.search,
                            mode: 'insensitive'
                          }
                        },
                        {
                          email: {
                            contains: query.search,
                            mode: 'insensitive'
                          }
                        },
                        {
                          phoneBinding: {
                            is: {
                              phoneNumber: {
                                contains: query.search,
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
                account: true,
                email: true,
                phoneBinding: { select: { phoneNumber: true } }
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
      tenants: tenants.map((tenant) => {
        const owner = tenant.members?.[0]?.user ?? null;
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          createdAt: tenant.createdAt.toISOString(),
          memberCount: tenant._count.members,
          ownerAccount: owner?.account ?? null,
          ownerEmail: owner?.email ?? null,
          ownerPhone: owner?.phoneBinding?.phoneNumber ?? null,
          subscriptionPlan: tenant.subscription?.plan ?? null,
          subscriptionStatus: tenant.subscription
            ? (tenant.subscription.disabledAt ? 'DISABLED' : tenant.subscription.expiresAt && tenant.subscription.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE')
            : null
        };
      })
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
        memberCount: tenant._count.members,
        ownerAccount: null,
        ownerEmail: null,
        ownerPhone: null,
        subscriptionPlan: null,
        subscriptionStatus: null
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
          memberCount: 0,
          ownerAccount: null,
          ownerEmail: null,
          ownerPhone: null,
          subscriptionPlan: null,
          subscriptionStatus: null
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
      user: { id: string; email: string; account: string | null; name: string | null };
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
