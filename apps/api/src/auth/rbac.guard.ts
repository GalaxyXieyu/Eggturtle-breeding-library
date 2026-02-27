import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@eggturtle/shared';
import type { TenantRole } from '@eggturtle/shared';

import { PrismaService } from '../prisma.service';

import type { AuthenticatedRequest } from './auth.types';
import { MINIMUM_TENANT_ROLE_KEY } from './rbac.constants';
import { hasMinimumTenantRole, toEffectiveTenantRole } from './rbac.policy';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<TenantRole>(MINIMUM_TENANT_ROLE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new UnauthorizedException({
        message: 'Authentication is required before role check.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    if (!request.tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: request.tenantId,
          userId: request.user.id
        }
      },
      select: {
        role: true
      }
    });

    if (!membership) {
      throw new ForbiddenException({
        message: 'User is not a member of this tenant.',
        errorCode: ErrorCode.NotTenantMember
      });
    }

    if (!hasMinimumTenantRole(membership.role, requiredRole)) {
      throw new ForbiddenException({
        message: `Tenant role ${toEffectiveTenantRole(requiredRole)} or above is required.`,
        errorCode: ErrorCode.Forbidden
      });
    }

    request.tenantRole = toEffectiveTenantRole(membership.role);
    return true;
  }
}
