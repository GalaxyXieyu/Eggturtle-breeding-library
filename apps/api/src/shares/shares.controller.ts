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
  StreamableFile,
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

import { SharesEntryService } from './shares-entry.service';
import { SharesPublicService } from './shares-public.service';

type PublicRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

@Controller()
export class SharesController {
  constructor(
    private readonly sharesEntryService: SharesEntryService,
    private readonly sharesPublicService: SharesPublicService
  ) {}

  @Post('shares')
  @UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
  @RequireTenantRole('EDITOR')
  async createShare(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(createShareRequestSchema, body);

    const share = await this.sharesEntryService.createShare(
      tenantId,
      actorUserId,
      payload,
      this.getRequestOrigin(request.headers as Record<string, string | string[] | undefined>)
    );

    return createShareResponseSchema.parse({ share });
  }

  @Get('s/:shareToken')
  async openShare(
    @Param('shareToken') shareToken: string,
    @Req() request: PublicRequest,
    @Res() response: { redirect: (statusCode: number, url: string) => unknown }
  ) {
    const result = await this.sharesEntryService.resolveShareEntry(
      shareToken,
      {
        ip: this.getRequestIp(request),
        userAgent: this.getUserAgent(request)
      },
      this.getRequestOrigin(request.headers)
    );

    return response.redirect(result.statusCode, result.redirectUrl);
  }

  @Get('shares/:shareId/public')
  async getPublicShare(
    @Param('shareId') shareId: string,
    @Query() query: unknown,
    @Req() request: PublicRequest
  ) {
    const parsedQuery = parseOrThrow(publicShareQuerySchema, query);

    const data = await this.sharesPublicService.getPublicShare(shareId, parsedQuery, {
      ip: this.getRequestIp(request),
      userAgent: this.getUserAgent(request)
    });

    return publicShareResponseSchema.parse(data);
  }

  @Get('shares/:shareId/public/assets')
  async getPublicShareAsset(
    @Param('shareId') shareId: string,
    @Query() query: unknown,
    @Req() request: PublicRequest,
    @Res({ passthrough: true }) response: { setHeader: (key: string, value: string) => void }
  ) {
    const parsedQuery = parseOrThrow(publicShareQuerySchema, query) as {
      tenantId: string;
      resourceType: 'tenant_feed';
      resourceId: string;
      productId?: string;
      maxEdge?: number;
      exp: string;
      sig: string;
    };

    const rawKey = (query as { key?: unknown }).key;
    if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      throw new BadRequestException({
        message: 'Invalid share asset key.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const asset = await this.sharesPublicService.getPublicShareAsset(
      shareId,
      { ...parsedQuery, key: rawKey.trim() },
      {
        ip: this.getRequestIp(request),
        userAgent: this.getUserAgent(request)
      }
    );

    // Cache only until the share signature expires.
    const maxAge = Math.max(0, Math.min(3600, Math.floor((asset.expiresAt.getTime() - Date.now()) / 1000)));
    response.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);

    if (asset.contentType) {
      response.setHeader('Content-Type', asset.contentType);
    }

    return new StreamableFile(asset.content);
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

  private getRequestOrigin(headers: Record<string, string | string[] | undefined>): string | null {
    const forwardedHost = this.readFirstHeaderValue(headers['x-forwarded-host']);
    const host = this.readFirstHeaderValue(headers.host);
    const resolvedHost = forwardedHost ?? host;

    if (!resolvedHost) {
      return null;
    }

    const forwardedProto = this.readFirstHeaderValue(headers['x-forwarded-proto'])?.toLowerCase();
    const protocol = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : 'https';

    return `${protocol}://${resolvedHost}`;
  }

  private readFirstHeaderValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      const first = value[0]?.trim();
      return first ? first : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const first = value.split(',')[0]?.trim();
    return first ? first : null;
  }
}
