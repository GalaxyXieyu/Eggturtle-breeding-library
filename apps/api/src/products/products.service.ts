import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  CreateProductRequest,
  ListProductsQuery,
  Product,
  ProductImage,
  ReorderProductImagesRequest
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { Product as PrismaProduct, ProductImage as PrismaProductImage } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

export type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type ProductImageContentResult =
  | {
      content: Buffer;
      contentType: string | null;
    }
  | {
      redirectUrl: string;
      contentType: string | null;
    };

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async createProduct(
    tenantId: string,
    actorUserId: string,
    payload: CreateProductRequest
  ): Promise<Product> {
    try {
      const product = await this.prisma.product.create({
        data: {
          tenantId,
          code: payload.code,
          name: payload.name ?? null,
          description: payload.description ?? null
        }
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCreate,
        resourceType: 'product',
        resourceId: product.id,
        metadata: {
          code: product.code,
          name: product.name
        }
      });

      return this.toProduct(product);
    } catch (error) {
      if (this.isProductCodeConflict(error)) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      throw error;
    }
  }

  async listProducts(tenantId: string, query: ListProductsQuery) {
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          tenantId
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: query.pageSize
      }),
      this.prisma.product.count({
        where: {
          tenantId
        }
      })
    ]);

    return {
      products: items.map((item) => this.toProduct(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  async uploadProductImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    file: UploadedBinaryFile
  ): Promise<ProductImage> {
    const product = await this.findProductOrThrow(tenantId, productId);
    await this.tenantSubscriptionsService.assertImageUploadAllowed(tenantId, file.buffer.length);

    const nextSortOrder = await this.getNextSortOrder(tenantId, product.id);
    const existingImageCount = await this.prisma.productImage.count({
      where: {
        tenantId,
        productId: product.id
      }
    });

    const extension = this.getFileExtension(file.originalname, file.mimetype);
    const key = `${tenantId}/products/${product.id}/${Date.now()}-${randomUUID()}${extension}`;
    const contentType = file.mimetype?.trim() || 'application/octet-stream';

    let uploadResult: { key: string; url: string } | null = null;

    try {
      uploadResult = await this.storageProvider.putObject({
        key,
        body: file.buffer,
        contentType
      });

      const image = await this.prisma.productImage.create({
        data: {
          tenantId,
          productId: product.id,
          key: uploadResult.key,
          url: uploadResult.url,
          contentType,
          sizeBytes: BigInt(file.buffer.length),
          sortOrder: nextSortOrder,
          isMain: existingImageCount === 0
        }
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductImageUpload,
        resourceType: 'product_image',
        resourceId: image.id,
        metadata: {
          productId: product.id,
          sortOrder: image.sortOrder,
          isMain: image.isMain
        }
      });

      return this.toProductImage(image);
    } catch (error) {
      if (uploadResult) {
        await this.storageProvider.deleteObject(uploadResult.key).catch(() => undefined);
      }
      throw error;
    }
  }

  async deleteProductImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    imageId: string
  ) {
    await this.findProductOrThrow(tenantId, productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        tenantId,
        productId
      }
    });

    if (!image) {
      throw new NotFoundException({
        message: 'Product image not found.',
        errorCode: ErrorCode.ProductImageNotFound
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({
        where: {
          id: image.id
        }
      });

      if (!image.isMain) {
        return;
      }

      const nextMainImage = await tx.productImage.findFirst({
        where: {
          tenantId,
          productId
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      });

      if (!nextMainImage) {
        return;
      }

      await tx.productImage.update({
        where: {
          id: nextMainImage.id
        },
        data: {
          isMain: true
        }
      });
    });

    await this.storageProvider.deleteObject(image.key);

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductImageDelete,
      resourceType: 'product_image',
      resourceId: image.id,
      metadata: {
        productId,
        wasMain: image.isMain
      }
    });

    return { deleted: true, imageId: image.id };
  }

  async setMainImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    imageId: string
  ): Promise<ProductImage> {
    await this.findProductOrThrow(tenantId, productId);

    const targetImage = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        tenantId,
        productId
      }
    });

    if (!targetImage) {
      throw new NotFoundException({
        message: 'Product image not found.',
        errorCode: ErrorCode.ProductImageNotFound
      });
    }

    const previousMainImage = await this.prisma.productImage.findFirst({
      where: {
        tenantId,
        productId,
        isMain: true
      },
      select: {
        id: true
      }
    });

    const updatedImage = await this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: {
          tenantId,
          productId
        },
        data: {
          isMain: false
        }
      });

      return tx.productImage.update({
        where: {
          id: targetImage.id
        },
        data: {
          isMain: true
        }
      });
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductImageSetMain,
      resourceType: 'product_image',
      resourceId: updatedImage.id,
      metadata: {
        productId,
        previousMainImageId: previousMainImage?.id ?? null
      }
    });

    return this.toProductImage(updatedImage);
  }

  async reorderImages(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ReorderProductImagesRequest
  ): Promise<ProductImage[]> {
    await this.findProductOrThrow(tenantId, productId);

    const uniqueIds = new Set(payload.imageIds);
    if (uniqueIds.size !== payload.imageIds.length) {
      throw new BadRequestException('imageIds contains duplicate values.');
    }

    const existingImages = await this.prisma.productImage.findMany({
      where: {
        tenantId,
        productId
      },
      select: {
        id: true
      }
    });

    const existingIdSet = new Set(existingImages.map((image) => image.id));
    if (
      payload.imageIds.length !== existingImages.length ||
      payload.imageIds.some((imageId) => !existingIdSet.has(imageId))
    ) {
      throw new BadRequestException('imageIds must include all images for this product exactly once.');
    }

    await this.prisma.$transaction(
      payload.imageIds.map((imageId, index) =>
        this.prisma.productImage.update({
          where: {
            id: imageId
          },
          data: {
            sortOrder: index
          }
        })
      )
    );

    const images = await this.prisma.productImage.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductImageReorder,
      resourceType: 'product',
      resourceId: productId,
      metadata: {
        imageIds: payload.imageIds
      }
    });

    return images.map((image) => this.toProductImage(image));
  }

  async getProductImageContent(
    tenantId: string,
    productId: string,
    imageId: string
  ): Promise<ProductImageContentResult> {
    await this.findProductOrThrow(tenantId, productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        tenantId,
        productId
      }
    });

    if (!image) {
      throw new NotFoundException({
        message: 'Product image not found.',
        errorCode: ErrorCode.ProductImageNotFound
      });
    }

    if (!this.isManagedStorageKey(tenantId, image.key)) {
      const redirectUrl = (image.url ?? '').trim();
      // Avoid open redirects or accidental exposure of internal URLs.
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        throw new NotFoundException({
          message: 'Product image not found.',
          errorCode: ErrorCode.ProductImageNotFound
        });
      }

      return {
        redirectUrl,
        contentType: image.contentType
      };
    }

    try {
      const storedObject = await this.storageProvider.getObject(image.key);
      return {
        content: storedObject.body,
        contentType: image.contentType ?? storedObject.contentType
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          message: 'Stored image binary was not found.',
          errorCode: ErrorCode.ProductImageNotFound
        });
      }

      throw error;
    }
  }

  private async findProductOrThrow(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId
      }
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound
      });
    }

    return product;
  }

  private async getNextSortOrder(tenantId: string, productId: string): Promise<number> {
    const aggregate = await this.prisma.productImage.aggregate({
      where: {
        tenantId,
        productId
      },
      _max: {
        sortOrder: true
      }
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private getFileExtension(originalName: string, mimeType: string): string {
    const extensionFromName = path.extname(originalName).trim();
    if (extensionFromName) {
      return extensionFromName.toLowerCase();
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };

    return extensionMap[mimeType] ?? '';
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

  private toProduct(product: PrismaProduct): Product {
    return {
      id: product.id,
      tenantId: product.tenantId,
      code: product.code,
      name: product.name,
      description: product.description
    };
  }

  private toProductImage(image: PrismaProductImage): ProductImage {
    return {
      id: image.id,
      tenantId: image.tenantId,
      productId: image.productId,
      key: image.key,
      url: this.buildImageAccessPath(image.productId, image.id),
      contentType: image.contentType,
      sortOrder: image.sortOrder,
      isMain: image.isMain
    };
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalizedKey.startsWith(`${tenantId}/`);
  }

  private buildImageAccessPath(productId: string, imageId: string): string {
    return `/products/${productId}/images/${imageId}/content`;
  }
}
