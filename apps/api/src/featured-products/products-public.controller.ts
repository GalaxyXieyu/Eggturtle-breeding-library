import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req
} from '@nestjs/common';
import {
  ErrorCode,
  listPublicFeaturedProductsQuerySchema,
  listPublicFeaturedProductsResponseSchema
} from '@eggturtle/shared';

import { AuthService } from '../auth/auth.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { parseOrThrow } from '../common/zod-parse';

import { FeaturedProductsService } from './featured-products.service';

@Controller('products')
export class ProductsPublicController {
  constructor(
    private readonly featuredProductsService: FeaturedProductsService,
    private readonly authService: AuthService
  ) {}

  @Get('featured')
  async listFeaturedProducts(@Query() query: unknown, @Req() request: AuthenticatedRequest) {
    const parsedQuery = parseOrThrow(listPublicFeaturedProductsQuerySchema, query);

    let tenantId = await this.featuredProductsService.resolveTenantId({
      tenantId: parsedQuery.tenantId,
      tenantSlug: parsedQuery.tenantSlug
    });

    if ((parsedQuery.tenantId || parsedQuery.tenantSlug) && !tenantId) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    if (!tenantId) {
      tenantId = await this.getTenantIdFromAuthorization(request.headers.authorization);
    }

    if (!tenantId) {
      throw new BadRequestException({
        message: 'tenantSlug/tenantId query or a tenant-scoped bearer token is required.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    const products = await this.featuredProductsService.listPublicFeaturedProducts(
      tenantId,
      parsedQuery.limit
    );

    return listPublicFeaturedProductsResponseSchema.parse({ products });
  }

  private async getTenantIdFromAuthorization(rawAuthorization?: string): Promise<string | null> {
    const token = this.extractBearerToken(rawAuthorization);

    if (!token) {
      return null;
    }

    const context = await this.authService.getAuthContextFromAccessToken(token);
    return context?.tenantId ?? null;
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
