import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, SuperAdminAuditAction } from '@eggturtle/shared';
import type {
  CreateAdminTenantRequest,
  CreateAdminTenantResponse,
  GetAdminTenantResponse,
  ListAdminTenantMembersQuery,
  ListAdminTenantMembersResponse,
  ListAdminTenantsQuery,
  ListAdminTenantsResponse,
  ListAdminUsersResponse,
  ListSuperAdminAuditLogsQuery,
  ListSuperAdminAuditLogsResponse,
  UpsertTenantMemberRequest,
  UpsertTenantMemberResponse
} from '@eggturtle/shared';
import { Prisma, TenantMemberRole } from '@prisma/client';

import { PrismaService } from '../prisma.service';

import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly superAdminAuditLogsService: SuperAdminAuditLogsService
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

    const result = await this.prisma.$transaction(async (tx) => {
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
}
