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
  confirmProductCertificateGenerateResponseSchema,
  createEggRecordRequestSchema,
  createMatingRecordRequestSchema,
  createProductEventRequestSchema,
  createProductEventResponseSchema,
  createProductRequestSchema,
  createProductResponseSchema,
  createSaleAllocationRequestSchema,
  createSaleAllocationResponseSchema,
  createSaleBatchRequestSchema,
  createSaleBatchResponseSchema,
  createSaleSubjectMediaRequestSchema,
  createSaleSubjectMediaResponseSchema,
  deleteProductImageResponseSchema,
  ErrorCode,
  generateProductCertificatePreviewResponseSchema,
  generateProductCouplePhotoRequestSchema,
  generateProductCouplePhotoResponseSchema,
  getCurrentProductCouplePhotoResponseSchema,
  getProductCertificateEligibilityResponseSchema,
  getProductFamilyTreeResponseSchema,
  getProductPublicClicksResponseSchema,
  getProductResponseSchema,
  listProductCertificateCenterQuerySchema,
  listProductCertificateCenterResponseSchema,
  listProductCertificatesResponseSchema,
  listProductCouplePhotosResponseSchema,
  listProductEventsResponseSchema,
  listProductImagesResponseSchema,
  listProductsPublicClicksQuerySchema,
  listProductsPublicClicksResponseSchema,
  listProductsQuerySchema,
  listProductsResponseSchema,
  listSaleBatchesResponseSchema,
  productCertificateGenerateRequestSchema,
  productCertificateSchema,
  productCodeSchema,
  productIdParamSchema,
  productPublicClicksQuerySchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  reissueProductCertificateRequestSchema,
  setMainProductImageResponseSchema,
  updateProductRequestSchema,
  uploadProductImageResponseSchema,
  voidProductCertificateRequestSchema
} from '@eggturtle/shared';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import { parseOrThrow } from '../common/zod-parse';

import { ProductGeneratedAssetsService } from './product-generated-assets.service';
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
  constructor(
    private readonly productsService: ProductsService,
    private readonly generatedAssetsService: ProductGeneratedAssetsService
  ) {}

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


  @Get('certificates/center')
  async listCertificateCenter(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(listProductCertificateCenterQuerySchema, query);
    const response = await this.generatedAssetsService.listCertificateCenter(tenantId, parsedQuery);

    return listProductCertificateCenterResponseSchema.parse(response);
  }

  @Post('certificates/:certificateId/void')
  @RequireTenantRole('EDITOR')
  async voidCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('certificateId') certificateId: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(voidProductCertificateRequestSchema, body);
    const response = await this.generatedAssetsService.voidCertificate(
      tenantId,
      actorUserId,
      certificateId,
      payload
    );

    return {
      certificate: productCertificateSchema.parse(response.certificate)
    };
  }

  @Post('certificates/:certificateId/reissue/preview')
  @RequireTenantRole('EDITOR')
  async previewReissueCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('certificateId') certificateId: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(reissueProductCertificateRequestSchema, body);
    const response = await this.generatedAssetsService.previewReissueCertificate(
      tenantId,
      actorUserId,
      certificateId,
      payload
    );

    return generateProductCertificatePreviewResponseSchema.parse(response);
  }

  @Post('certificates/:certificateId/reissue/confirm')
  @RequireTenantRole('EDITOR')
  async confirmReissueCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('certificateId') certificateId: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(reissueProductCertificateRequestSchema, body);
    const response = await this.generatedAssetsService.confirmReissueCertificate(
      tenantId,
      actorUserId,
      certificateId,
      payload
    );

    return confirmProductCertificateGenerateResponseSchema.parse(response);
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


  @Get(':id/sale-batches')
  async listSaleBatches(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const response = await this.generatedAssetsService.listSaleBatches(tenantId, productId);

    return listSaleBatchesResponseSchema.parse(response);
  }

  @Post(':id/sale-batches')
  @RequireTenantRole('EDITOR')
  async createSaleBatch(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(createSaleBatchRequestSchema, body);
    const response = await this.generatedAssetsService.createSaleBatch(
      tenantId,
      actorUserId,
      productId,
      payload
    );

    return createSaleBatchResponseSchema.parse(response);
  }

  @Post(':id/sale-allocations')
  @RequireTenantRole('EDITOR')
  async createSaleAllocation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(createSaleAllocationRequestSchema, body);
    const response = await this.generatedAssetsService.createSaleAllocation(
      tenantId,
      actorUserId,
      productId,
      payload
    );

    return createSaleAllocationResponseSchema.parse(response);
  }

  @Post(':id/sale-subject-media')
  @RequireTenantRole('EDITOR')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024
      }
    })
  )
  async uploadSaleSubjectMedia(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedBinaryFile | undefined
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(createSaleSubjectMediaRequestSchema, body);

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A single image file is required in form field "file".');
    }

    const response = await this.generatedAssetsService.uploadSaleSubjectMedia(
      tenantId,
      actorUserId,
      productId,
      payload,
      file
    );

    return createSaleSubjectMediaResponseSchema.parse(response);
  }

  @Get(':id/certificates/eligibility')
  async getCertificateEligibility(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const result = await this.generatedAssetsService.getCertificateEligibility(tenantId, productId);

    return getProductCertificateEligibilityResponseSchema.parse(result);
  }

  @Post(':id/certificates/preview')
  @RequireTenantRole('EDITOR')
  async previewCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(productCertificateGenerateRequestSchema, body);
    const response = await this.generatedAssetsService.previewCertificate(
      tenantId,
      actorUserId,
      productId,
      payload
    );

    return generateProductCertificatePreviewResponseSchema.parse(response);
  }

  @Post(':id/certificates/confirm')
  @RequireTenantRole('EDITOR')
  async confirmCertificate(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(productCertificateGenerateRequestSchema, body);
    const response = await this.generatedAssetsService.confirmCertificate(
      tenantId,
      actorUserId,
      productId,
      payload
    );

    return confirmProductCertificateGenerateResponseSchema.parse(response);
  }

  @Get(':id/certificates')
  async listCertificates(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const response = await this.generatedAssetsService.listCertificates(tenantId, productId);

    return listProductCertificatesResponseSchema.parse(response);
  }

  @Get(':pid/certificates/:cid/content')
  async getCertificateContent(
    @Req() request: AuthenticatedRequest,
    @Param('pid') productId: string,
    @Param('cid') certificateId: string,
    @Res({ passthrough: true }) response: PassthroughResponse
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const content = await this.generatedAssetsService.getCertificateContent(
      tenantId,
      productId,
      certificateId
    );

    response.setHeader('Cache-Control', 'private, no-store');

    if ('redirectUrl' in content) {
      response.redirect(content.redirectUrl);
      return;
    }

    if (content.contentType) {
      response.setHeader('Content-Type', content.contentType);
    }

    return new StreamableFile(content.content);
  }

  @Post(':id/couple-photos/generate')
  @RequireTenantRole('EDITOR')
  async generateCouplePhoto(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const productId = parseOrThrow(productIdParamSchema, id);
    const payload = parseOrThrow(generateProductCouplePhotoRequestSchema, body);
    const result = await this.generatedAssetsService.generateCouplePhoto(
      tenantId,
      actorUserId,
      productId,
      payload
    );

    return generateProductCouplePhotoResponseSchema.parse(result);
  }

  @Get(':id/couple-photos/current')
  async getCurrentCouplePhoto(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const result = await this.generatedAssetsService.getCurrentCouplePhoto(tenantId, productId);

    return getCurrentProductCouplePhotoResponseSchema.parse(result);
  }

  @Get(':id/couple-photos/history')
  async listCouplePhotoHistory(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const productId = parseOrThrow(productIdParamSchema, id);
    const result = await this.generatedAssetsService.listCouplePhotosHistory(tenantId, productId);

    return listProductCouplePhotosResponseSchema.parse(result);
  }

  @Get(':pid/couple-photos/:photoId/content')
  async getCouplePhotoContent(
    @Req() request: AuthenticatedRequest,
    @Param('pid') productId: string,
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: PassthroughResponse
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const content = await this.generatedAssetsService.getCouplePhotoContent(tenantId, productId, photoId);

    response.setHeader('Cache-Control', 'private, no-store');

    if ('redirectUrl' in content) {
      response.redirect(content.redirectUrl);
      return;
    }

    if (content.contentType) {
      response.setHeader('Content-Type', content.contentType);
    }

    return new StreamableFile(content.content);
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
    @Query('maxEdge') maxEdge: string | undefined,
    @Res({ passthrough: true }) response: PassthroughResponse
  ) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedMaxEdge = maxEdge ? Number(maxEdge) : undefined;
    const imageContent = await this.productsService.getProductImageContent(tenantId, productId, imageId, {
      maxEdge: parsedMaxEdge
    });

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
