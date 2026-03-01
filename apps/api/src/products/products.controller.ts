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
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  createEggRecordRequestSchema,
  createMatingRecordRequestSchema,
  createProductEventRequestSchema,
  createProductEventResponseSchema,
  ErrorCode,
  createProductRequestSchema,
  createProductResponseSchema,
  deleteProductImageResponseSchema,
  getProductFamilyTreeResponseSchema,
  getProductPublicClicksResponseSchema,
  getProductResponseSchema,
  listProductImagesResponseSchema,
  listProductsPublicClicksQuerySchema,
  listProductsPublicClicksResponseSchema,
  listProductEventsResponseSchema,
  listProductsQuerySchema,
  listProductsResponseSchema,
  productCodeSchema,
  productIdParamSchema,
  productPublicClicksQuerySchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  updateProductRequestSchema,
  uploadProductImageResponseSchema
} from '@eggturtle/shared';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import { parseOrThrow } from '../common/zod-parse';

import { ProductsService } from './products.service';

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type PassthroughResponse = {
  setHeader: (name: string, value: string) => void;
  redirect: (url: string) => void;
};

@Controller('products')
@UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
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

  @Get('by-code/:code')
  async getProductByCode(@Req() request: AuthenticatedRequest, @Param('code') code: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedCode = parseOrThrow(productCodeSchema, code);
    const product = await this.productsService.getProductByCode(tenantId, parsedCode);

    return getProductResponseSchema.parse({ product });
  }

  @Get('public-clicks')
  async listProductPublicClicks(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(listProductsPublicClicksQuerySchema, query);
    const response = await this.productsService.listProductPublicClicks(tenantId, parsedQuery);

    return listProductsPublicClicksResponseSchema.parse(response);
  }

  @Post('mating-records')
  @RequireTenantRole('EDITOR')
  async createMatingRecord(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(createMatingRecordRequestSchema, body);
    const event = await this.productsService.createMatingRecord(tenantId, actorUserId, payload);

    return createProductEventResponseSchema.parse({ event });
  }

  @Post('egg-records')
  @RequireTenantRole('EDITOR')
  async createEggRecord(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(createEggRecordRequestSchema, body);
    const event = await this.productsService.createEggRecord(tenantId, actorUserId, payload);

    return createProductEventResponseSchema.parse({ event });
  }

  @Get(':id')
  async getProductById(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const product = await this.productsService.getProductById(tenantId, productId);

    return getProductResponseSchema.parse({ product });
  }

  @Put(':id')
  @RequireTenantRole('EDITOR')
  async updateProduct(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(updateProductRequestSchema, body);
    const product = await this.productsService.updateProduct(tenantId, actorUserId, productId, payload);

    return getProductResponseSchema.parse({ product });
  }

  @Get(':id/public-clicks')
  async getProductPublicClicks(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const parsedQuery = parseOrThrow(productPublicClicksQuerySchema, query);
    const stats = await this.productsService.getProductPublicClicks(tenantId, productId, parsedQuery.days);

    return getProductPublicClicksResponseSchema.parse({ stats });
  }

  @Get(':id/events')
  async listProductEvents(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const events = await this.productsService.listProductEvents(tenantId, productId);

    return listProductEventsResponseSchema.parse({ events });
  }

  @Post(':id/events')
  @RequireTenantRole('EDITOR')
  async createProductEvent(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(createProductEventRequestSchema, body);
    const event = await this.productsService.createProductEvent(tenantId, actorUserId, productId, payload);

    return createProductEventResponseSchema.parse({ event });
  }

  @Get(':id/family-tree')
  async getProductFamilyTree(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const tree = await this.productsService.getProductFamilyTree(tenantId, productId);

    return getProductFamilyTreeResponseSchema.parse({ tree });
  }

  @Get(':id/images')
  async listImages(@Req() request: AuthenticatedRequest, @Param('id') productId: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const images = await this.productsService.listProductImages(tenantId, productId);

    return listProductImagesResponseSchema.parse({ images });
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

  @Get(':pid/images/:iid/content')
  async getImageContent(
    @Req() request: AuthenticatedRequest,
    @Param('pid') productId: string,
    @Param('iid') imageId: string,
    @Res({ passthrough: true }) response: PassthroughResponse
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const imageContent = await this.productsService.getProductImageContent(tenantId, productId, imageId);

    response.setHeader('Cache-Control', 'private, no-store');

    if ('redirectUrl' in imageContent) {
      response.redirect(imageContent.redirectUrl);
      return;
    }

    if (imageContent.contentType) {
      response.setHeader('Content-Type', imageContent.contentType);
    }

    return new StreamableFile(imageContent.content);
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
