import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import {
  ErrorCode,
  createShareRequestSchema,
  createShareResponseSchema,
  publicShareQuerySchema,
  publicShareResponseSchema
} from '@eggturtle/shared';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import { parseOrThrow } from '../common/zod-parse';

import { SharesService } from './shares.service';

type PublicRequest = {
  headers: {
    'x-forwarded-for'?: string;
    'user-agent'?: string;
  };
  ip?: string;
};

@Controller()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post('shares')
  @UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
  @RequireTenantRole('EDITOR')
  async createShare(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(createShareRequestSchema, body);

    const share = await this.sharesService.createShare(tenantId, actorUserId, payload);

    return createShareResponseSchema.parse({ share });
  }

  @Get('s/:shareToken')
  async openShare(
    @Param('shareToken') shareToken: string,
    @Req() request: PublicRequest,
    @Res() response: { redirect: (statusCode: number, url: string) => unknown }
  ) {
    const result = await this.sharesService.resolveShareEntry(shareToken, {
      ip: this.getRequestIp(request),
      userAgent: this.getUserAgent(request)
    });

    return response.redirect(result.statusCode, result.redirectUrl);
  }

  @Get('shares/:shareId/public')
  async getPublicShare(
    @Param('shareId') shareId: string,
    @Query() query: unknown,
    @Req() request: PublicRequest
  ) {
    const parsedQuery = parseOrThrow(publicShareQuerySchema, query);

    const data = await this.sharesService.getPublicShare(shareId, parsedQuery, {
      ip: this.getRequestIp(request),
      userAgent: this.getUserAgent(request)
    });

    return publicShareResponseSchema.parse(data);
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    return tenantId;
  }

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException({
        message: 'No user found in access token.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    return userId;
  }

  private getRequestIp(request: PublicRequest): string | null {
    const forwarded = request.headers['x-forwarded-for'];

    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0]?.trim() ?? null;
    }

    if (request.ip && request.ip.trim().length > 0) {
      return request.ip;
    }

    return null;
  }

  private getUserAgent(request: PublicRequest): string | null {
    const userAgent = request.headers['user-agent'];

    if (typeof userAgent === 'string' && userAgent.trim().length > 0) {
      return userAgent;
    }

    return null;
  }
}
