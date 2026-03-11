import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  CreateProductRequest,
  ListProductsPublicClicksQuery,
  ListProductsQuery,
  Product,
  ProductEvent,
  ProductFamilyTree,
  ProductImage,
  ProductMaleMatingHistoryItem,
  ProductPublicClicksSummary,
  ReorderProductImagesRequest,
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { Product as PrismaProduct } from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import {
  buildTaggedNote,
  normalizeCodeUpper,
  processPairTransitionDescription,
} from './breeding-rules';
import { ProductsEventsService } from './products-events.service';
import { ProductsImagesService } from './products-images.service';
import { ProductsReadService } from './products-read.service';
import type {
  CreateEggRecordInput,
  CreateMatingRecordInput,
  CreateProductEventInput,
  ProductImageContentResult,
  UpdateProductEventInput,
  UpdateProductInput,
  UploadedBinaryFile,
} from './products.types';

export type {
  CreateEggRecordInput,
  CreateMatingRecordInput,
  CreateProductEventInput,
  ProductImageContentResult,
  UpdateProductEventInput,
  UpdateProductInput,
  UploadedBinaryFile,
} from './products.types';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
    private readonly productsReadService: ProductsReadService,
    private readonly productsEventsService: ProductsEventsService,
    private readonly productsImagesService: ProductsImagesService,
  ) {}

  async createProduct(
    tenantId: string,
    actorUserId: string,
    payload: CreateProductRequest,
  ): Promise<Product> {
    await this.tenantSubscriptionsService.assertProductCreateAllowed(tenantId);
    const normalizedCode = this.normalizeRequiredCode(payload.code);
    const existingByCode = await this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (existingByCode) {
      throw new ConflictException('Product code already exists in this tenant.');
    }

    if (payload.offspringUnitPrice !== null && payload.offspringUnitPrice !== undefined) {
      const resolvedSex = this.normalizeOptionalSex(payload.sex);
      if (resolvedSex !== 'female') {
        throw new BadRequestException('offspringUnitPrice is only allowed for female breeders.');
      }
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          tenantId,
          code: normalizedCode,
          type: this.normalizeOptionalText(payload.type) ?? 'breeder',
          name: this.normalizeOptionalText(payload.name) ?? normalizedCode,
          description: this.normalizeOptionalText(payload.description),
          seriesId: this.normalizeOptionalText(payload.seriesId),
          sex: this.normalizeOptionalSex(payload.sex),
          offspringUnitPrice: payload.offspringUnitPrice ?? null,
          sireCode: this.normalizeOptionalCode(payload.sireCode),
          damCode: this.normalizeOptionalCode(payload.damCode),
          mateCode: this.normalizeOptionalCode(payload.mateCode),
          excludeFromBreeding: payload.excludeFromBreeding ?? false,
          hasSample: payload.hasSample ?? false,
          inStock: payload.inStock ?? true,
          popularityScore: payload.popularityScore ?? 0,
          isFeatured: payload.isFeatured ?? false,
        },
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCreate,
        resourceType: 'product',
        resourceId: product.id,
        metadata: {
          code: product.code,
          name: product.name,
        },
      });

      return this.toProduct(product);
    } catch (error) {
      if (this.isProductCodeConflict(error)) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      throw error;
    }
  }

  async updateProduct(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: UpdateProductInput,
  ): Promise<Product> {
    const product = await this.findProductOrThrow(tenantId, productId);
    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    const resolvedSex =
      payload.sex === undefined
        ? this.normalizeOptionalSex(product.sex)
        : this.normalizeOptionalSex(payload.sex);

    if (payload.offspringUnitPrice !== undefined && payload.offspringUnitPrice !== null && resolvedSex !== 'female') {
      throw new BadRequestException('offspringUnitPrice is only allowed for female breeders.');
    }

    if (payload.code !== undefined) {
      const nextCode = this.normalizeRequiredCode(payload.code);
      const existingByCode = await this.prisma.product.findFirst({
        where: {
          tenantId,
          id: {
            not: product.id,
          },
          code: {
            equals: nextCode,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      if (existingByCode) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      updateData.code = nextCode;
    }

    if (payload.type !== undefined) {
      updateData.type = this.normalizeOptionalText(payload.type) ?? 'breeder';
    }

    if (payload.name !== undefined) {
      updateData.name = this.normalizeOptionalText(payload.name);
    }

    if (payload.description !== undefined) {
      updateData.description = processPairTransitionDescription(
        product.description,
        this.normalizeOptionalText(payload.description),
      );
    }

    if (payload.seriesId !== undefined) {
      updateData.seriesId = this.normalizeOptionalText(payload.seriesId);
    }

    if (payload.sex !== undefined) {
      updateData.sex = resolvedSex;
    }

    if (payload.offspringUnitPrice !== undefined) {
      updateData.offspringUnitPrice = payload.offspringUnitPrice ?? null;
    }

    if (payload.sireCode !== undefined) {
      updateData.sireCode = this.normalizeOptionalCode(payload.sireCode);
    }

    if (payload.damCode !== undefined) {
      updateData.damCode = this.normalizeOptionalCode(payload.damCode);
    }

    if (payload.mateCode !== undefined) {
      updateData.mateCode = this.normalizeOptionalCode(payload.mateCode);
    }

    if (payload.excludeFromBreeding !== undefined) {
      updateData.excludeFromBreeding = payload.excludeFromBreeding;
    }

    if (payload.hasSample !== undefined) {
      updateData.hasSample = payload.hasSample;
    }

    if (payload.inStock !== undefined) {
      updateData.inStock = payload.inStock;
    }

    if (payload.popularityScore !== undefined) {
      updateData.popularityScore = payload.popularityScore;
    }

    if (payload.isFeatured !== undefined) {
      updateData.isFeatured = payload.isFeatured;
    }

    if (payload.sex !== undefined && resolvedSex !== 'female') {
      updateData.offspringUnitPrice = null;
    }

    const previousMateCode = normalizeCodeUpper(product.mateCode);
    const nextMateCode =
      payload.mateCode === undefined ? previousMateCode : this.normalizeOptionalCode(payload.mateCode);
    const mateCodeChanged = previousMateCode !== nextMateCode;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
          where: {
            id: product.id,
          },
          data: updateData,
        });

        if (mateCodeChanged && (resolvedSex ?? '').toLowerCase() === 'female') {
          await tx.productCouplePhoto.updateMany({
            where: {
              tenantId,
              femaleProductId: updatedProduct.id,
              isCurrent: true,
            },
            data: {
              isCurrent: false,
              staleReason: 'mate_changed',
            },
          });

          await tx.productEvent.create({
            data: {
              tenantId,
              productId: updatedProduct.id,
              eventType: 'change_mate',
              eventDate: new Date(),
              note: buildTaggedNote('自动记录：配偶变更', {
                oldMateCode: previousMateCode,
                newMateCode: nextMateCode,
              }),
            },
          });
        }

        return updatedProduct;
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductUpdate,
        resourceType: 'product',
        resourceId: updated.id,
        metadata: {
          previousMateCode,
          nextMateCode,
        },
      });

      return this.toProduct(updated);
    } catch (error) {
      if (this.isProductCodeConflict(error)) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      throw error;
    }
  }

  async createMatingRecord(
    tenantId: string,
    actorUserId: string,
    payload: CreateMatingRecordInput,
  ): Promise<ProductEvent> {
    return this.productsEventsService.createMatingRecord(tenantId, actorUserId, payload);
  }

  async createEggRecord(
    tenantId: string,
    actorUserId: string,
    payload: CreateEggRecordInput,
  ): Promise<ProductEvent> {
    return this.productsEventsService.createEggRecord(tenantId, actorUserId, payload);
  }

  async createProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: CreateProductEventInput,
  ): Promise<ProductEvent> {
    return this.productsEventsService.createProductEvent(tenantId, actorUserId, productId, payload);
  }

  async listProducts(tenantId: string, query: ListProductsQuery) {
    return this.productsReadService.listProducts(tenantId, query);
  }

  async getProductByCode(tenantId: string, code: string): Promise<Product> {
    return this.productsReadService.getProductByCode(tenantId, code);
  }

  async getProductById(tenantId: string, productId: string): Promise<Product> {
    return this.productsReadService.getProductById(tenantId, productId);
  }

  async getProductPublicClicks(
    tenantId: string,
    productId: string,
    days: number,
  ): Promise<ProductPublicClicksSummary> {
    return this.productsReadService.getProductPublicClicks(tenantId, productId, days);
  }

  async listProductPublicClicks(tenantId: string, query: ListProductsPublicClicksQuery) {
    return this.productsReadService.listProductPublicClicks(tenantId, query);
  }

  async listProductEvents(tenantId: string, productId: string): Promise<ProductEvent[]> {
    return this.productsEventsService.listProductEvents(tenantId, productId);
  }

  async updateProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    eventId: string,
    payload: UpdateProductEventInput,
  ): Promise<ProductEvent> {
    return this.productsEventsService.updateProductEvent(tenantId, actorUserId, productId, eventId, payload);
  }

  async deleteProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    eventId: string,
  ): Promise<{ deleted: boolean; eventId: string }> {
    return this.productsEventsService.deleteProductEvent(tenantId, actorUserId, productId, eventId);
  }

  async listProductMaleMatingHistory(
    tenantId: string,
    productId: string,
  ): Promise<ProductMaleMatingHistoryItem[]> {
    return this.productsReadService.listProductMaleMatingHistory(tenantId, productId);
  }

  async getProductFamilyTree(tenantId: string, productId: string): Promise<ProductFamilyTree> {
    return this.productsReadService.getProductFamilyTree(tenantId, productId);
  }

  async listProductImages(tenantId: string, productId: string): Promise<ProductImage[]> {
    return this.productsImagesService.listProductImages(tenantId, productId);
  }

  async uploadProductImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    file: UploadedBinaryFile,
  ): Promise<ProductImage> {
    return this.productsImagesService.uploadProductImage(tenantId, actorUserId, productId, file);
  }

  async deleteProductImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    imageId: string,
  ) {
    return this.productsImagesService.deleteProductImage(tenantId, actorUserId, productId, imageId);
  }

  async setMainImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    imageId: string,
  ): Promise<ProductImage> {
    return this.productsImagesService.setMainImage(tenantId, actorUserId, productId, imageId);
  }

  async reorderImages(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ReorderProductImagesRequest,
  ): Promise<ProductImage[]> {
    return this.productsImagesService.reorderImages(tenantId, actorUserId, productId, payload);
  }

  async getProductImageContent(
    tenantId: string,
    productId: string,
    imageId: string,
    options?: {
      maxEdge?: number;
    },
  ): Promise<ProductImageContentResult> {
    return this.productsImagesService.getProductImageContent(tenantId, productId, imageId, options);
  }

  private async findProductOrThrow(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound,
      });
    }

    return product;
  }

  private isProductCodeConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('tenant_id') && target.includes('code');
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
  }

  private normalizeOptionalCode(value: string | null | undefined): string | null {
    return normalizeCodeUpper(value);
  }

  private normalizeRequiredCode(value: string): string {
    const normalized = this.normalizeOptionalCode(value);
    if (!normalized) {
      throw new BadRequestException('code is required.');
    }

    return normalized;
  }

  private normalizeOptionalSex(value: string | null | undefined): string | null {
    const normalizedValue = this.normalizeOptionalText(value);
    return normalizedValue ? normalizedValue.toLowerCase() : null;
  }

  private toProduct(product: PrismaProduct): Product {
    return {
      id: product.id,
      tenantId: product.tenantId,
      code: product.code,
      type: product.type?.trim() || 'breeder',
      name: product.name,
      description: product.description,
      seriesId: product.seriesId,
      sex: product.sex,
      needMatingStatus: null,
      lastEggAt: null,
      lastMatingAt: null,
      daysSinceEgg: null,
      offspringUnitPrice: product.offspringUnitPrice?.toNumber() ?? null,
      sireCode: product.sireCode,
      damCode: product.damCode,
      mateCode: product.mateCode,
      excludeFromBreeding: product.excludeFromBreeding,
      hasSample: product.hasSample,
      inStock: product.inStock,
      popularityScore: product.popularityScore,
      isFeatured: product.isFeatured,
      coverImageUrl: null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
