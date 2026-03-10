import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@eggturtle/shared';

import type { AuthenticatedRequest } from './auth.types';
import { REQUIRE_SUPER_ADMIN_KEY } from './super-admin.constants';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException({
        message: 'Authentication is required before super-admin check.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    if (!user.isSuperAdmin) {
      throw new ForbiddenException({
        message: 'Admin access denied.',
        errorCode: ErrorCode.Forbidden
      });
    }

    return true;
  }
}
