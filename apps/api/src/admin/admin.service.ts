import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, SuperAdminAuditAction } from '@eggturtle/shared';
import type {
  CreateAdminTenantRequest,
  CreateAdminTenantResponse,
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

  async listTenants(actorUserId: string): Promise<ListAdminTenantsResponse> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      action: SuperAdminAuditAction.ListTenants,
      metadata: {
        resultCount: tenants.length
      }
    });

    return {
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      }))
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
          name: tenant.name
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

      await this.superAdminAuditLogsService.createLog(
        {
          actorUserId,
          targetTenantId: tenant.id,
          action: SuperAdminAuditAction.UpsertTenantMember,
          metadata: {
            tenantSlug: tenant.slug,
            memberUserId: user.id,
            memberEmail: user.email,
            role: membership.role,
            created
          }
        },
        tx
      );

      return {
        user,
        membership,
        created
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
      created: result.created
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
