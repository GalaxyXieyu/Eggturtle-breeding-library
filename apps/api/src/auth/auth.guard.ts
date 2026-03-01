import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';

import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

const PRODUCT_IMAGE_CONTENT_PATH_PATTERN = /^\/products\/[^/]+\/images\/[^/]+\/content$/;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization) ?? this.extractImageQueryToken(request);

    if (!token) {
      throw new UnauthorizedException({
        message: 'Missing bearer token.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    const authContext = await this.authService.getAuthContextFromAccessToken(token);
    if (!authContext) {
      throw new UnauthorizedException({
        message: 'Invalid access token.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    request.user = authContext.user;
    request.tenantId = authContext.tenantId;
    return true;
  }

  private extractImageQueryToken(request: AuthenticatedRequest): string | null {
    if (request.method !== 'GET') {
      return null;
    }

    if (!PRODUCT_IMAGE_CONTENT_PATH_PATTERN.test(request.path ?? '')) {
      return null;
    }

    const token = request.query?.accessToken;
    if (typeof token === 'string' && token.trim()) {
      return token.trim();
    }

    if (Array.isArray(token) && typeof token[0] === 'string' && token[0].trim()) {
      return token[0].trim();
    }

    return null;
  }

  private extractBearerToken(rawAuthorization?: string): string | null {
    if (!rawAuthorization) {
      return null;
    }

    const [scheme, token] = rawAuthorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
