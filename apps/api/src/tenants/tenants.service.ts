import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Prisma, TenantMemberRole } from '@prisma/client';
import { ErrorCode } from '@eggturtle/shared';
import type { AuthUser, CreateTenantRequest } from '@eggturtle/shared';

import { PrismaService } from '../prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(user: AuthUser, payload: CreateTenantRequest) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: payload.slug,
            name: payload.name
          }
        });

        const membership = await tx.tenantMember.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: TenantMemberRole.OWNER
          }
        });

        return {
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name
          },
          role: membership.role
        };
      });
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

  async listMyTenants(userId: string) {
    const memberships = await this.prisma.tenantMember.findMany({
      where: {
        userId
      },
      include: {
        tenant: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return memberships.map((membership) => ({
      tenant: {
        id: membership.tenant.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name
      },
      role: membership.role
    }));
  }

  async getCurrentTenant(userId: string, tenantId?: string) {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId
        }
      },
      include: {
        tenant: true
      }
    });

    if (!membership) {
      throw new ForbiddenException({
        message: 'User is not a member of this tenant.',
        errorCode: ErrorCode.NotTenantMember
      });
    }

    return {
      tenant: {
        id: membership.tenant.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name
      },
      role: membership.role
    };
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
