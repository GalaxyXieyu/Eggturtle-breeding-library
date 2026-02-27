import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  ErrorCode,
  createFeaturedProductRequestSchema,
  createFeaturedProductResponseSchema,
  deleteFeaturedProductResponseSchema,
  listFeaturedProductsResponseSchema,
  reorderFeaturedProductsRequestSchema,
  reorderFeaturedProductsResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { parseOrThrow } from '../common/zod-parse';

import { FeaturedProductsService } from './featured-products.service';

@Controller('featured-products')
@UseGuards(AuthGuard, RbacGuard)
export class FeaturedProductsController {
  constructor(private readonly featuredProductsService: FeaturedProductsService) {}

  @Get()
  async listFeaturedProducts(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const items = await this.featuredProductsService.listFeaturedProducts(tenantId);

    return listFeaturedProductsResponseSchema.parse({ items });
  }

  @Post()
  @RequireTenantRole('EDITOR')
  async createFeaturedProduct(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(createFeaturedProductRequestSchema, body);
    const item = await this.featuredProductsService.createFeaturedProduct(tenantId, payload);

    return createFeaturedProductResponseSchema.parse({ item });
  }

  @Delete(':id')
  @RequireTenantRole('EDITOR')
  async deleteFeaturedProduct(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const result = await this.featuredProductsService.deleteFeaturedProduct(tenantId, id);

    return deleteFeaturedProductResponseSchema.parse(result);
  }

  @Put('reorder')
  @RequireTenantRole('EDITOR')
  async reorderFeaturedProducts(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(reorderFeaturedProductsRequestSchema, body);
    const items = await this.featuredProductsService.reorderFeaturedProducts(tenantId, payload);

    return reorderFeaturedProductsResponseSchema.parse({ items });
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
}
