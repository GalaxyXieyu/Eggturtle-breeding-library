import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  ErrorCode,
  createProductRequestSchema,
  createProductResponseSchema,
  deleteProductImageResponseSchema,
  listProductsQuerySchema,
  listProductsResponseSchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  uploadProductImageResponseSchema
} from '@eggturtle/shared';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { parseOrThrow } from '../common/zod-parse';

import { ProductsService } from './products.service';

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Controller('products')
@UseGuards(AuthGuard, RbacGuard)
@RequireTenantRole('VIEWER')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequireTenantRole('EDITOR')
  async createProduct(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(createProductRequestSchema, body);
    const product = await this.productsService.createProduct(tenantId, actorUserId, payload);

    return createProductResponseSchema.parse({ product });
  }

  @Get()
  async listProducts(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(listProductsQuerySchema, query);
    const response = await this.productsService.listProducts(tenantId, parsedQuery);

    return listProductsResponseSchema.parse(response);
  }

  @Post(':id/images')
  @RequireTenantRole('EDITOR')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  async uploadImage(
    @Req() request: AuthenticatedRequest,
    @Param('id') productId: string,
    @UploadedFile() file: UploadedBinaryFile | undefined
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A single image file is required in form field "file".');
    }

    const image = await this.productsService.uploadProductImage(tenantId, actorUserId, productId, file);

    return uploadProductImageResponseSchema.parse({ image });
  }

  @Delete(':pid/images/:iid')
  @RequireTenantRole('EDITOR')
  async deleteImage(
    @Req() request: AuthenticatedRequest,
    @Param('pid') productId: string,
    @Param('iid') imageId: string
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const response = await this.productsService.deleteProductImage(tenantId, actorUserId, productId, imageId);

    return deleteProductImageResponseSchema.parse(response);
  }

  @Put(':pid/images/:iid/main')
  @RequireTenantRole('EDITOR')
  async setMainImage(
    @Req() request: AuthenticatedRequest,
    @Param('pid') productId: string,
    @Param('iid') imageId: string
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const image = await this.productsService.setMainImage(tenantId, actorUserId, productId, imageId);

    return setMainProductImageResponseSchema.parse({ image });
  }

  @Put(':pid/images/reorder')
  @RequireTenantRole('EDITOR')
  async reorderImages(
    @Req() request: AuthenticatedRequest,
    @Param('pid') productId: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(reorderProductImagesRequestSchema, body);
    const images = await this.productsService.reorderImages(tenantId, actorUserId, productId, payload);

    return reorderProductImagesResponseSchema.parse({ images });
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
}
