import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@eggturtle/shared';

import type { AuthenticatedRequest } from './auth.types';
import { REQUIRE_SUPER_ADMIN_KEY } from './super-admin.constants';

function parseSuperAdminEmails(rawValue: string | undefined): Set<string> {
  if (!rawValue) {
    return new Set();
  }

  return new Set(
    rawValue
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (process.env.SUPER_ADMIN_ENABLED !== 'true') {
      throw new ForbiddenException({
        message: 'Super-admin backoffice is disabled by environment.',
        errorCode: ErrorCode.Forbidden
      });
    }

    const allowlist = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAILS);
    if (allowlist.size === 0 || !allowlist.has(user.email.toLowerCase())) {
      throw new ForbiddenException({
        message: 'User is not in SUPER_ADMIN_EMAILS allowlist.',
        errorCode: ErrorCode.Forbidden
      });
    }

    return true;
  }
}
