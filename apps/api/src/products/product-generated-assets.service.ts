import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  type CertificateQuota,
  type ConfirmProductCertificateGenerateResponse,
  type CreateSaleAllocationRequest,
  type CreateSaleBatchRequest,
  type CreateSaleSubjectMediaRequest,
  type GenerateProductCertificatePreviewResponse,
  type GenerateProductCouplePhotoRequest,
  type GenerateProductCouplePhotoResponse,
  type GetCurrentProductCouplePhotoResponse,
  type GetProductCertificateEligibilityResponse,
  type ListProductCertificateCenterResponse,
  type ListProductCertificatesResponse,
  type ListProductCouplePhotosResponse,
  type ProductCertificateCenterItem,
  type ProductCertificate,
  type ProductCertificateGenerateRequest,
  type ProductCertificateEligibilityRequirements,
  type ProductCouplePhoto,
  type ReissueProductCertificateRequest,
  type SaleAllocation,
  type SaleBatch,
  type SaleSubjectMedia,
  type VerifyProductCertificateResponse,
  type VoidProductCertificateRequest
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type {
  Product as PrismaProduct,
  ProductCertificate as PrismaProductCertificateModel,
  ProductCouplePhoto as PrismaProductCouplePhotoModel,
  SaleAllocation as PrismaSaleAllocationModel,
  SaleBatch as PrismaSaleBatchModel,
  SaleSubjectMedia as PrismaSaleSubjectMediaModel
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';

import { normalizeCodeUpper, parseCurrentMateCode } from './breeding-rules';
import { parseTaggedProductEventNote } from './product-event-utils';
import { renderCertificatePng, renderCouplePhotoPng } from './rendering/generated-media-renderer';

const CERTIFICATE_MONTHLY_LIMIT = 100;
const DEFAULT_CERTIFICATE_TEMPLATE_VERSION = 'v1';
const DEFAULT_COUPLE_PHOTO_TEMPLATE_VERSION = 'v1';
const DEFAULT_SHARE_ENTRY_BASE_URL = 'http://localhost:30011';

type CertificateLineageContext = {
  tenantId: string;
  tenantName: string;
  product: PrismaProduct;
  saleBatch: PrismaSaleBatchModel | null;
  saleAllocation: PrismaSaleAllocationModel | null;
  subjectMedia: PrismaSaleSubjectMediaModel | null;
  seriesName: string | null;
  sireProduct: PrismaProduct | null;
  subjectImageKey: string | null;
  sireImageKey: string | null;
  damImageKey: string | null;
  requirements: ProductCertificateEligibilityRequirements;
};

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type CouplePhotoContext = {
  tenantId: string;
  tenantName: string;
  femaleProduct: PrismaProduct;
  maleProduct: PrismaProduct;
  seriesName: string | null;
  femaleImageKey: string | null;
  maleImageKey: string | null;
};

type StoredContentResult =
  | {
      content: Buffer;
      contentType: string | null;
    }
  | {
      redirectUrl: string;
      contentType: string | null;
    };

@Injectable()
export class ProductGeneratedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async getCertificateEligibility(
    tenantId: string,
    productId: string
  ): Promise<GetProductCertificateEligibilityResponse> {
    const context = await this.loadCertificateLineageContext(tenantId, productId);
    const quota = await this.getCertificateQuota(tenantId);
    const reasons = this.buildEligibilityReasons(context.requirements, quota);

    return {
      eligible: reasons.length === 0,
      reasons,
      requirements: context.requirements,
      quota
    };
  }

  async previewCertificate(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ProductCertificateGenerateRequest
  ): Promise<GenerateProductCertificatePreviewResponse> {
    const context = await this.loadCertificateLineageContext(tenantId, productId, payload);
    this.assertCertificateLineageEligible(context.requirements);

    const issuedAt = new Date();
    const certNo = this.buildCertificateNo(context.saleBatch?.batchNo || context.product.code, issuedAt);
    const verifyId = this.buildVerifyId();
    const quota = await this.getCertificateQuota(tenantId, this.getMonthKey(issuedAt));
    const templateVersion = payload.templateVersion?.trim() || DEFAULT_CERTIFICATE_TEMPLATE_VERSION;
    const png = await this.renderCertificateImage({
      context,
      actorUserId,
      issuedAt,
      certNo,
      verifyId,
      templateVersion,
      buyerName: payload.buyerName,
      buyerAccountId: payload.buyerAccountId
    });

    return {
      preview: {
        certNo,
        verifyId,
        mimeType: 'image/png',
        imageBase64: png.toString('base64')
      },
      quota
    };
  }

  async confirmCertificate(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ProductCertificateGenerateRequest
  ): Promise<ConfirmProductCertificateGenerateResponse> {
    const context = await this.loadCertificateLineageContext(tenantId, productId, payload);
    this.assertCertificateLineageEligible(context.requirements);

    const issuedAt = new Date();
    const quota = await this.getCertificateQuota(tenantId, this.getMonthKey(issuedAt));
    if (quota.remaining <= 0) {
      throw new ForbiddenException({
        message: 'Monthly certificate quota exceeded.',
        errorCode: ErrorCode.ProductCertificateQuotaExceeded
      });
    }

    const certNo = this.buildCertificateNo(context.saleBatch?.batchNo || context.product.code, issuedAt);
    const verifyId = this.buildVerifyId();
    const templateVersion = payload.templateVersion?.trim() || DEFAULT_CERTIFICATE_TEMPLATE_VERSION;
    const png = await this.renderCertificateImage({
      context,
      actorUserId,
      issuedAt,
      certNo,
      verifyId,
      templateVersion,
      buyerName: payload.buyerName,
      buyerAccountId: payload.buyerAccountId
    });
    const watermarkSnapshot = this.buildWatermarkSnapshot(context.tenantName);
    const lineageSnapshot = this.buildLineageSnapshot(context);
    const saleSnapshot = this.buildSaleSnapshot(context);
    const imageKey = this.buildCertificateStorageKey(tenantId, context.product.id);

    let uploadResult: { key: string; url: string; contentType: string | null } | null = null;

    try {
      uploadResult = await this.storageProvider.putObject({
        key: imageKey,
        body: png,
        contentType: 'image/png',
        metadata: {
          tenantId,
          productId: context.product.id,
          source: 'product.certificate'
        }
      });

      const { certificate, quota } = await this.prisma.$transaction(async (tx) => {
        const quotaResult = await this.consumeCertificateQuota(tx, tenantId, this.getMonthKey(issuedAt));
        const created = await tx.productCertificate.create({
          data: {
            tenantId,
            productId: context.product.id,
            eggEventId: context.saleBatch?.eggEventId ?? payload.eggEventId,
            saleBatchId: context.saleBatch?.id ?? payload.saleBatchId,
            saleAllocationId: context.saleAllocation?.id ?? payload.saleAllocationId,
            subjectMediaId: context.subjectMedia?.id ?? payload.subjectMediaId,
            certNo,
            verifyId,
            status: 'ISSUED',
            templateVersion,
            lineageSnapshot: lineageSnapshot as Prisma.InputJsonValue,
            saleSnapshot: saleSnapshot as Prisma.InputJsonValue,
            watermarkSnapshot: watermarkSnapshot as Prisma.InputJsonValue,
            imageKey: uploadResult?.key ?? imageKey,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? 'image/png',
            sizeBytes: BigInt(png.length),
            issuedAt,
            issuedByUserId: actorUserId
          }
        });

        return {
          certificate: created,
          quota: quotaResult
        };
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCertificateConfirm,
        resourceType: 'product_certificate',
        resourceId: certificate.id,
        metadata: {
          productId: context.product.id,
          saleBatchId: context.saleBatch?.id ?? null,
          saleAllocationId: context.saleAllocation?.id ?? null,
          certNo,
          verifyId,
          templateVersion
        }
      });

      return {
        certificate: this.toProductCertificate(certificate),
        quota
      };
    } catch (error) {
      if (uploadResult?.key) {
        await this.storageProvider.deleteObject(uploadResult.key).catch(() => undefined);
      }

      if (this.isCertificateConflict(error)) {
        throw new ConflictException('Certificate number conflict, please retry.');
      }

      throw error;
    }
  }

  async listCertificates(tenantId: string, productId: string): Promise<ListProductCertificatesResponse> {
    await this.findProductOrThrow(tenantId, productId);

    const rows = await this.prisma.productCertificate.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return {
      items: rows.map((item) => this.toProductCertificate(item))
    };
  }

  async getCertificateContent(
    tenantId: string,
    productId: string,
    certificateId: string
  ): Promise<StoredContentResult> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: {
        id: certificateId,
        tenantId,
        productId
      },
      select: {
        imageKey: true,
        imageUrl: true,
        contentType: true
      }
    });

    if (!certificate) {
      throw new NotFoundException({
        message: 'Product certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      });
    }

    return this.resolveStoredBinary(tenantId, certificate.imageKey, certificate.imageUrl, {
      notFoundMessage: 'Product certificate content not found.',
      errorCode: ErrorCode.ProductCertificateNotFound,
      contentType: certificate.contentType
    });
  }

  async listSaleBatches(tenantId: string, femaleProductId: string): Promise<{ items: SaleBatch[] }> {
    await this.findProductOrThrow(tenantId, femaleProductId);

    const rows = await this.prisma.saleBatch.findMany({
      where: {
        tenantId,
        femaleProductId
      },
      include: {
        allocations: {
          orderBy: [{ soldAt: 'desc' }, { createdAt: 'desc' }]
        },
        subjectMedia: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
        }
      },
      orderBy: [{ eventDateSnapshot: 'desc' }, { createdAt: 'desc' }]
    });

    return {
      items: rows.map((row) => this.toSaleBatch(row))
    };
  }

  async createSaleBatch(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: CreateSaleBatchRequest
  ): Promise<{ batch: SaleBatch }> {
    const femaleProduct = await this.findProductOrThrow(tenantId, femaleProductId);
    if ((femaleProduct.sex ?? '').toLowerCase() !== 'female') {
      throw new BadRequestException('Only female breeders can create sale batches.');
    }

    const eggEvent = await this.prisma.productEvent.findFirst({
      where: {
        id: payload.eggEventId,
        tenantId,
        productId: femaleProductId,
        eventType: 'egg'
      }
    });

    if (!eggEvent) {
      throw new NotFoundException({
        message: 'Egg event not found for selected female breeder.',
        errorCode: ErrorCode.SaleBatchNotFound
      });
    }

    const latestMating = await this.prisma.productEvent.findFirst({
      where: {
        tenantId,
        productId: femaleProductId,
        eventType: 'mating',
        eventDate: {
          lte: eggEvent.eventDate
        }
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    const sireCode = this.normalizeOptionalCode(parseTaggedProductEventNote(latestMating?.note ?? null).maleCode);
    if (!sireCode) {
      throw new BadRequestException({
        message: 'Unable to lock sire from the selected egg event.',
        errorCode: ErrorCode.SaleBatchEventMismatch
      });
    }

    const existingBatch = await this.prisma.saleBatch.findFirst({
      where: {
        tenantId,
        femaleProductId,
        eggEventId: eggEvent.id
      },
      include: {
        allocations: {
          orderBy: [{ soldAt: 'desc' }, { createdAt: 'desc' }]
        },
        subjectMedia: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
        }
      }
    });

    if (existingBatch) {
      return {
        batch: this.toSaleBatch(existingBatch)
      };
    }

    const seriesName = await this.resolveSeriesName(tenantId, femaleProduct.seriesId);
    const eggCountSnapshot = parseTaggedProductEventNote(eggEvent.note).eggCount ?? null;
    const batchNo = this.buildSaleBatchNo(femaleProduct.code, eggEvent.eventDate);
    const created = await this.prisma.saleBatch.create({
      data: {
        tenantId,
        femaleProductId,
        eggEventId: eggEvent.id,
        batchNo,
        status: 'OPEN',
        plannedQuantity: payload.plannedQuantity,
        soldQuantity: 0,
        eventDateSnapshot: eggEvent.eventDate,
        eggCountSnapshot,
        femaleCodeSnapshot: femaleProduct.code,
        sireCodeSnapshot: sireCode,
        seriesNameSnapshot: seriesName,
        priceLow: payload.priceLow ?? null,
        priceHigh: payload.priceHigh ?? null,
        note: payload.note ?? null
      },
      include: {
        allocations: true,
        subjectMedia: true
      }
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.SaleBatchCreate,
      resourceType: 'sale_batch',
      resourceId: created.id,
      metadata: {
        femaleProductId,
        eggEventId: eggEvent.id,
        batchNo
      }
    });

    return {
      batch: this.toSaleBatch(created)
    };
  }

  async createSaleAllocation(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: CreateSaleAllocationRequest
  ): Promise<{ allocation: SaleAllocation; batch: SaleBatch }> {
    await this.findProductOrThrow(tenantId, femaleProductId);
    const batch = await this.findSaleBatchOrThrow(tenantId, payload.saleBatchId, { femaleProductId });
    const remaining = Math.max(0, batch.plannedQuantity - batch.soldQuantity);
    if (payload.quantity > remaining) {
      throw new BadRequestException({
        message: `Only ${remaining} items remain in this batch.`,
        errorCode: ErrorCode.SaleBatchQuantityExceeded
      });
    }

    const allocationNo = this.buildSaleAllocationNo(batch.batchNo);
    const soldAt = payload.soldAt ? new Date(payload.soldAt) : new Date();
    const unitPrice = payload.unitPrice ?? null;
    const nextPriceLow =
      unitPrice === null
        ? batch.priceLow
        : batch.priceLow === null
          ? unitPrice
          : Math.min(batch.priceLow.toNumber(), unitPrice);
    const nextPriceHigh =
      unitPrice === null
        ? batch.priceHigh
        : batch.priceHigh === null
          ? unitPrice
          : Math.max(batch.priceHigh.toNumber(), unitPrice);
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.saleAllocation.create({
        data: {
          tenantId,
          saleBatchId: batch.id,
          allocationNo,
          status: 'SOLD',
          quantity: payload.quantity,
          buyerName: payload.buyerName,
          buyerAccountId: payload.buyerAccountId ?? null,
          buyerContact: payload.buyerContact ?? null,
          unitPrice: payload.unitPrice ?? null,
          channel: payload.channel ?? null,
          campaignId: payload.campaignId ?? null,
          note: payload.note ?? null,
          soldAt
        }
      });

      const soldQuantity = batch.soldQuantity + payload.quantity;
      await tx.saleBatch.update({
        where: {
          id: batch.id
        },
        data: {
          soldQuantity,
          priceLow: nextPriceLow,
          priceHigh: nextPriceHigh,
          status:
            soldQuantity >= batch.plannedQuantity
              ? 'SOLD'
              : soldQuantity > 0
                ? 'PARTIAL'
                : 'OPEN'
        }
      });

      const refreshedBatch = await tx.saleBatch.findUniqueOrThrow({
        where: {
          id: batch.id
        },
        include: {
          allocations: {
            orderBy: [{ soldAt: 'desc' }, { createdAt: 'desc' }]
          },
          subjectMedia: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
          }
        }
      });

      return {
        allocation: created,
        batch: refreshedBatch
      };
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.SaleAllocationCreate,
      resourceType: 'sale_allocation',
      resourceId: result.allocation.id,
      metadata: {
        femaleProductId,
        saleBatchId: batch.id,
        allocationNo
      }
    });

    return {
      allocation: this.toSaleAllocation(result.allocation),
      batch: this.toSaleBatch(result.batch)
    };
  }

  async uploadSaleSubjectMedia(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: CreateSaleSubjectMediaRequest,
    file: UploadedBinaryFile
  ): Promise<{ media: SaleSubjectMedia; batch: SaleBatch }> {
    await this.findProductOrThrow(tenantId, femaleProductId);
    const batch = await this.findSaleBatchOrThrow(tenantId, payload.saleBatchId, { femaleProductId });

    const key = this.buildSaleSubjectMediaStorageKey(tenantId, femaleProductId, file.originalname, file.mimetype);
    const contentType = file.mimetype?.trim() || 'application/octet-stream';
    let uploadResult: { key: string; url: string; contentType: string | null } | null = null;

    try {
      uploadResult = await this.storageProvider.putObject({
        key,
        body: file.buffer,
        contentType,
        metadata: {
          tenantId,
          femaleProductId,
          saleBatchId: batch.id,
          source: 'sale.subject_media'
        }
      });

      const result = await this.prisma.$transaction(async (tx) => {
        if (payload.isPrimary) {
          await tx.saleSubjectMedia.updateMany({
            where: {
              tenantId,
              saleBatchId: batch.id
            },
            data: {
              isPrimary: false
            }
          });
        }

        const created = await tx.saleSubjectMedia.create({
          data: {
            tenantId,
            femaleProductId,
            saleBatchId: batch.id,
            label: payload.label ?? null,
            imageKey: uploadResult?.key ?? key,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? contentType,
            sizeBytes: BigInt(file.buffer.length),
            isPrimary: payload.isPrimary ?? false
          }
        });

        const refreshedBatch = await tx.saleBatch.findUniqueOrThrow({
          where: { id: batch.id },
          include: {
            allocations: {
              orderBy: [{ soldAt: 'desc' }, { createdAt: 'desc' }]
            },
            subjectMedia: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }]
            }
          }
        });

        return {
          media: created,
          batch: refreshedBatch
        };
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.SaleSubjectMediaUpload,
        resourceType: 'sale_subject_media',
        resourceId: result.media.id,
        metadata: {
          femaleProductId,
          saleBatchId: batch.id
        }
      });

      return {
        media: this.toSaleSubjectMedia(result.media),
        batch: this.toSaleBatch(result.batch)
      };
    } catch (error) {
      if (uploadResult?.key) {
        await this.storageProvider.deleteObject(uploadResult.key).catch(() => undefined);
      }
      throw error;
    }
  }

  async listCertificateCenter(
    tenantId: string,
    query: { productId?: string; status?: ProductCertificate['status']; batchId?: string; q?: string; limit: number }
  ): Promise<ListProductCertificateCenterResponse> {
    const rows = await this.prisma.productCertificate.findMany({
      where: {
        tenantId,
        productId: query.productId,
        saleBatchId: query.batchId,
        status: query.status
      },
      include: {
        product: {
          select: {
            code: true,
            name: true
          }
        },
        saleBatch: true,
        saleAllocation: true,
        subjectMedia: true,
        eggEvent: {
          select: {
            eventDate: true
          }
        }
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit
    });

    const keyword = query.q?.trim().toLowerCase();
    const items = rows
      .filter((row) => {
        if (!keyword) {
          return true;
        }

        return [
          row.certNo,
          row.verifyId,
          row.product.code,
          row.product.name,
          row.saleBatch?.batchNo,
          row.saleAllocation?.buyerName,
          row.saleAllocation?.allocationNo
        ]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(keyword));
      })
      .map((row) => this.toProductCertificateCenterItem(row));

    return { items };
  }

  async voidCertificate(
    tenantId: string,
    actorUserId: string,
    certificateId: string,
    payload: VoidProductCertificateRequest
  ): Promise<{ certificate: ProductCertificate }> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: {
        id: certificateId,
        tenantId
      }
    });

    if (!certificate) {
      throw new NotFoundException({
        message: 'Product certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      });
    }

    if (certificate.status !== 'ISSUED') {
      throw new BadRequestException({
        message: 'Certificate is already void.',
        errorCode: ErrorCode.ProductCertificateAlreadyVoid
      });
    }

    const updated = await this.prisma.productCertificate.update({
      where: {
        id: certificate.id
      },
      data: {
        status: 'VOID_MANUAL',
        voidReason: payload.voidReason ?? '手动作废'
      }
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductCertificateVoid,
      resourceType: 'product_certificate',
      resourceId: updated.id,
      metadata: {
        voidReason: updated.voidReason
      }
    });

    return {
      certificate: this.toProductCertificate(updated)
    };
  }

  async previewReissueCertificate(
    tenantId: string,
    actorUserId: string,
    certificateId: string,
    payload: ReissueProductCertificateRequest
  ): Promise<GenerateProductCertificatePreviewResponse> {
    const certificate = await this.findReissuableCertificateOrThrow(tenantId, certificateId);
    const request = this.buildReissueGeneratePayload(certificate, payload);
    return this.previewCertificate(tenantId, actorUserId, certificate.productId, request);
  }

  async confirmReissueCertificate(
    tenantId: string,
    actorUserId: string,
    certificateId: string,
    payload: ReissueProductCertificateRequest
  ): Promise<ConfirmProductCertificateGenerateResponse> {
    const previousCertificate = await this.findReissuableCertificateOrThrow(tenantId, certificateId);
    const request = this.buildReissueGeneratePayload(previousCertificate, payload);
    const context = await this.loadCertificateLineageContext(tenantId, previousCertificate.productId, request);
    this.assertCertificateLineageEligible(context.requirements);

    const issuedAt = new Date();
    const quota = await this.getCertificateQuota(tenantId, this.getMonthKey(issuedAt));
    if (quota.remaining <= 0) {
      throw new ForbiddenException({
        message: 'Monthly certificate quota exceeded.',
        errorCode: ErrorCode.ProductCertificateQuotaExceeded
      });
    }

    const certNo = this.buildCertificateNo(context.saleBatch?.batchNo || context.product.code, issuedAt);
    const verifyId = this.buildVerifyId();
    const templateVersion = request.templateVersion?.trim() || DEFAULT_CERTIFICATE_TEMPLATE_VERSION;
    const png = await this.renderCertificateImage({
      context,
      actorUserId,
      issuedAt,
      certNo,
      verifyId,
      templateVersion
    });
    const watermarkSnapshot = this.buildWatermarkSnapshot(context.tenantName);
    const lineageSnapshot = this.buildLineageSnapshot(context);
    const saleSnapshot = this.buildSaleSnapshot(context);
    const imageKey = this.buildCertificateStorageKey(tenantId, context.product.id);
    const voidReason = payload.voidReason?.trim() || '补发重开';

    let uploadResult: { key: string; url: string; contentType: string | null } | null = null;

    try {
      uploadResult = await this.storageProvider.putObject({
        key: imageKey,
        body: png,
        contentType: 'image/png',
        metadata: {
          tenantId,
          productId: context.product.id,
          previousCertificateId: previousCertificate.id,
          source: 'product.certificate.reissue'
        }
      });

      const { certificate, quota: nextQuota } = await this.prisma.$transaction(async (tx) => {
        const quotaResult = await this.consumeCertificateQuota(tx, tenantId, this.getMonthKey(issuedAt));
        await tx.productCertificate.update({
          where: {
            id: previousCertificate.id
          },
          data: {
            status: 'VOID_SUPERSEDED',
            voidReason
          }
        });

        const created = await tx.productCertificate.create({
          data: {
            tenantId,
            productId: context.product.id,
            eggEventId: context.saleBatch?.eggEventId ?? request.eggEventId,
            saleBatchId: context.saleBatch?.id ?? request.saleBatchId,
            saleAllocationId: context.saleAllocation?.id ?? request.saleAllocationId,
            subjectMediaId: context.subjectMedia?.id ?? request.subjectMediaId,
            previousCertificateId: previousCertificate.id,
            versionNo: previousCertificate.versionNo + 1,
            certNo,
            verifyId,
            status: 'ISSUED',
            templateVersion,
            lineageSnapshot: lineageSnapshot as Prisma.InputJsonValue,
            saleSnapshot: saleSnapshot as Prisma.InputJsonValue,
            watermarkSnapshot: watermarkSnapshot as Prisma.InputJsonValue,
            imageKey: uploadResult?.key ?? imageKey,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? 'image/png',
            sizeBytes: BigInt(png.length),
            issuedAt,
            issuedByUserId: actorUserId
          }
        });

        return {
          certificate: created,
          quota: quotaResult
        };
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCertificateReissue,
        resourceType: 'product_certificate',
        resourceId: certificate.id,
        metadata: {
          previousCertificateId: previousCertificate.id,
          saleBatchId: context.saleBatch?.id ?? null,
          saleAllocationId: context.saleAllocation?.id ?? null,
          certNo,
          verifyId,
          versionNo: previousCertificate.versionNo + 1,
          voidReason
        }
      });

      return {
        certificate: this.toProductCertificate(certificate),
        quota: nextQuota
      };
    } catch (error) {
      if (uploadResult?.key) {
        await this.storageProvider.deleteObject(uploadResult.key).catch(() => undefined);
      }
      throw error;
    }
  }

  async generateCouplePhoto(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: GenerateProductCouplePhotoRequest
  ): Promise<GenerateProductCouplePhotoResponse> {
    const context = await this.loadCouplePhotoContext(tenantId, femaleProductId);
    const templateVersion = payload.templateVersion?.trim() || DEFAULT_COUPLE_PHOTO_TEMPLATE_VERSION;
    const watermarkSnapshot = this.buildWatermarkSnapshot(context.tenantName);
    const generatedAt = new Date();

    const [femaleImage, maleImage] = await Promise.all([
      this.loadManagedImageBuffer(tenantId, context.femaleImageKey),
      this.loadManagedImageBuffer(tenantId, context.maleImageKey)
    ]);

    const png = await renderCouplePhotoPng({
      style: {
        femaleCode: context.femaleProduct.code,
        maleCode: context.maleProduct.code,
        lineLabel: context.seriesName ? `系别：${context.seriesName}` : '系别：未设置',
        priceLabel:
          context.femaleProduct.offspringUnitPrice !== null
            ? `种苗参考价：¥${context.femaleProduct.offspringUnitPrice.toFixed(2)}`
            : '种苗参考价：未设置',
        generatedAtLabel: `生成时间：${this.formatDateTime(generatedAt)}`,
        watermarkText: this.buildWatermarkText(context.tenantName)
      },
      femaleImage,
      maleImage
    });

    const key = this.buildCouplePhotoStorageKey(tenantId, context.femaleProduct.id);
    let uploadResult: { key: string; url: string; contentType: string | null } | null = null;

    try {
      uploadResult = await this.storageProvider.putObject({
        key,
        body: png,
        contentType: 'image/png',
        metadata: {
          tenantId,
          productId: context.femaleProduct.id,
          source: 'product.couple_photo'
        }
      });

      const photo = await this.prisma.$transaction(async (tx) => {
        await tx.productCouplePhoto.updateMany({
          where: {
            tenantId,
            femaleProductId: context.femaleProduct.id,
            isCurrent: true
          },
          data: {
            isCurrent: false,
            staleReason: 'replaced'
          }
        });

        return tx.productCouplePhoto.create({
          data: {
            tenantId,
            femaleProductId: context.femaleProduct.id,
            maleProductIdSnapshot: context.maleProduct.id,
            femaleCodeSnapshot: context.femaleProduct.code,
            maleCodeSnapshot: context.maleProduct.code,
            femaleImageKeySnapshot: context.femaleImageKey,
            maleImageKeySnapshot: context.maleImageKey,
            priceSnapshot: context.femaleProduct.offspringUnitPrice,
            templateVersion,
            watermarkSnapshot: watermarkSnapshot as Prisma.InputJsonValue,
            imageKey: uploadResult?.key ?? key,
            imageUrl: uploadResult?.url ?? '',
            contentType: uploadResult?.contentType ?? 'image/png',
            sizeBytes: BigInt(png.length),
            generatedAt,
            generatedByUserId: actorUserId,
            isCurrent: true,
            staleReason: null
          }
        });
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCouplePhotoGenerate,
        resourceType: 'product_couple_photo',
        resourceId: photo.id,
        metadata: {
          femaleProductId: context.femaleProduct.id,
          maleProductId: context.maleProduct.id,
          templateVersion
        }
      });

      return {
        photo: this.toProductCouplePhoto(photo)
      };
    } catch (error) {
      if (uploadResult?.key) {
        await this.storageProvider.deleteObject(uploadResult.key).catch(() => undefined);
      }

      throw error;
    }
  }

  async getCurrentCouplePhoto(
    tenantId: string,
    femaleProductId: string
  ): Promise<GetCurrentProductCouplePhotoResponse> {
    await this.findProductOrThrow(tenantId, femaleProductId);

    const row = await this.prisma.productCouplePhoto.findFirst({
      where: {
        tenantId,
        femaleProductId,
        isCurrent: true
      },
      orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return {
      photo: row ? this.toProductCouplePhoto(row) : null
    };
  }

  async listCouplePhotosHistory(
    tenantId: string,
    femaleProductId: string
  ): Promise<ListProductCouplePhotosResponse> {
    await this.findProductOrThrow(tenantId, femaleProductId);

    const rows = await this.prisma.productCouplePhoto.findMany({
      where: {
        tenantId,
        femaleProductId
      },
      orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return {
      items: rows.map((item) => this.toProductCouplePhoto(item))
    };
  }

  async getCouplePhotoContent(
    tenantId: string,
    femaleProductId: string,
    photoId: string
  ): Promise<StoredContentResult> {
    const photo = await this.prisma.productCouplePhoto.findFirst({
      where: {
        id: photoId,
        tenantId,
        femaleProductId
      },
      select: {
        imageKey: true,
        imageUrl: true,
        contentType: true
      }
    });

    if (!photo) {
      throw new NotFoundException({
        message: 'Product couple photo not found.',
        errorCode: ErrorCode.ProductCouplePhotoNotFound
      });
    }

    return this.resolveStoredBinary(tenantId, photo.imageKey, photo.imageUrl, {
      notFoundMessage: 'Product couple photo content not found.',
      errorCode: ErrorCode.ProductCouplePhotoNotFound,
      contentType: photo.contentType
    });
  }

  async getSaleSubjectMediaContent(saleBatchId: string, mediaId: string): Promise<StoredContentResult> {
    const media = await this.prisma.saleSubjectMedia.findFirst({
      where: {
        id: mediaId,
        saleBatchId
      },
      select: {
        tenantId: true,
        imageKey: true,
        imageUrl: true,
        contentType: true
      }
    });

    if (!media) {
      throw new NotFoundException({
        message: 'Sale subject media not found.',
        errorCode: ErrorCode.SaleSubjectMediaNotFound
      });
    }

    return this.resolveStoredBinary(media.tenantId, media.imageKey, media.imageUrl, {
      notFoundMessage: 'Sale subject media content not found.',
      errorCode: ErrorCode.SaleSubjectMediaNotFound,
      contentType: media.contentType
    });
  }

  async verifyCertificate(verifyId: string): Promise<VerifyProductCertificateResponse> {
    const certificate = await this.prisma.productCertificate.findUnique({
      where: {
        verifyId
      },
      include: {
        tenant: {
          select: {
            name: true
          }
        },
        product: {
          select: {
            code: true,
            name: true
          }
        },
        saleBatch: true,
        saleAllocation: true,
        subjectMedia: true
      }
    });

    if (!certificate) {
      throw new NotFoundException({
        message: 'Certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      });
    }

    return {
      certificate: {
        id: certificate.id,
        verifyId: certificate.verifyId,
        certNo: certificate.certNo,
        status: certificate.status as ProductCertificate['status'],
        versionNo: certificate.versionNo,
        issuedAt: certificate.issuedAt.toISOString(),
        tenantName: certificate.tenant.name,
        productCode: certificate.product.code,
        productName: certificate.product.name,
        lineageSnapshot: certificate.lineageSnapshot,
        saleSnapshot: certificate.saleSnapshot,
        watermarkSnapshot: certificate.watermarkSnapshot,
        contentPath: this.buildPublicCertificateContentPath(certificate.verifyId),
        subjectContentPath: certificate.subjectMedia
          ? this.buildSaleSubjectMediaContentPath(certificate.subjectMedia.saleBatchId, certificate.subjectMedia.id)
          : null,
        batch: certificate.saleBatch
          ? {
              id: certificate.saleBatch.id,
              batchNo: certificate.saleBatch.batchNo,
              status: certificate.saleBatch.status as SaleBatch['status'],
              plannedQuantity: certificate.saleBatch.plannedQuantity,
              soldQuantity: certificate.saleBatch.soldQuantity,
              eventDateSnapshot: certificate.saleBatch.eventDateSnapshot.toISOString(),
              eggCountSnapshot: certificate.saleBatch.eggCountSnapshot,
              priceLow: this.decimalToNumber(certificate.saleBatch.priceLow),
              priceHigh: this.decimalToNumber(certificate.saleBatch.priceHigh)
            }
          : null,
        allocation: certificate.saleAllocation
          ? {
              id: certificate.saleAllocation.id,
              allocationNo: certificate.saleAllocation.allocationNo,
              buyerName: certificate.saleAllocation.buyerName,
              buyerAccountId: certificate.saleAllocation.buyerAccountId,
              buyerContact: certificate.saleAllocation.buyerContact,
              quantity: certificate.saleAllocation.quantity,
              unitPrice: this.decimalToNumber(certificate.saleAllocation.unitPrice),
              channel: certificate.saleAllocation.channel,
              campaignId: certificate.saleAllocation.campaignId,
              soldAt: certificate.saleAllocation.soldAt.toISOString()
            }
          : null
      }
    };
  }

  async getVerifiedCertificateContent(verifyId: string): Promise<StoredContentResult> {
    const certificate = await this.prisma.productCertificate.findUnique({
      where: {
        verifyId
      },
      select: {
        tenantId: true,
        imageKey: true,
        imageUrl: true,
        contentType: true
      }
    });

    if (!certificate) {
      throw new NotFoundException({
        message: 'Certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      });
    }

    return this.resolveStoredBinary(certificate.tenantId, certificate.imageKey, certificate.imageUrl, {
      notFoundMessage: 'Certificate content not found.',
      errorCode: ErrorCode.ProductCertificateNotFound,
      contentType: certificate.contentType
    });
  }

  private async loadCertificateLineageContext(
    tenantId: string,
    productId: string,
    payload?: Pick<
      ProductCertificateGenerateRequest,
      'eggEventId' | 'saleBatchId' | 'saleAllocationId' | 'subjectMediaId'
    >
  ): Promise<CertificateLineageContext> {
    const [product, tenant] = await Promise.all([
      this.findProductOrThrow(tenantId, productId),
      this.prisma.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true,
          name: true
        }
      })
    ]);

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const [seriesName, saleBatch, saleAllocation, subjectMedia] = await Promise.all([
      this.resolveSeriesName(tenantId, product.seriesId),
      payload?.saleBatchId
        ? this.findSaleBatchOrThrow(tenantId, payload.saleBatchId, {
            femaleProductId: product.id,
            eggEventId: payload.eggEventId
          })
        : Promise.resolve(null),
      payload?.saleAllocationId ? this.findSaleAllocationOrThrow(tenantId, payload.saleAllocationId) : Promise.resolve(null),
      payload?.subjectMediaId ? this.findSaleSubjectMediaOrThrow(tenantId, payload.subjectMediaId) : Promise.resolve(null)
    ]);

    if (saleAllocation && saleBatch && saleAllocation.saleBatchId !== saleBatch.id) {
      throw new BadRequestException({
        message: 'Sale allocation does not belong to selected batch.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (subjectMedia && saleBatch && subjectMedia.saleBatchId !== saleBatch.id) {
      throw new BadRequestException({
        message: 'Subject media does not belong to selected batch.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const sireCode = saleBatch?.sireCodeSnapshot ?? (await this.resolveCurrentMateCode(tenantId, product));
    const [sireProduct, sireImageKey, damImageKey] = await Promise.all([
      this.findProductByCode(tenantId, sireCode),
      sireCode ? this.findMainImageKeyByCode(tenantId, sireCode) : Promise.resolve(null),
      this.findMainImageKey(tenantId, product.id)
    ]);

    const subjectImageKey = subjectMedia?.imageKey ?? (await this.findMainImageKey(tenantId, product.id));

    const hasSireGrandparentTrace = Boolean(
      this.normalizeOptionalCode(sireProduct?.sireCode) || this.normalizeOptionalCode(sireProduct?.damCode)
    );
    const hasDamGrandparentTrace = Boolean(
      this.normalizeOptionalCode(product.sireCode) || this.normalizeOptionalCode(product.damCode)
    );
    const requirements: ProductCertificateEligibilityRequirements = {
      hasSireCode: Boolean(sireCode),
      hasDamCode: Boolean(product.code),
      hasParentGrandparentTrace: hasSireGrandparentTrace || hasDamGrandparentTrace
    };

    return {
      tenantId,
      tenantName: tenant.name,
      product,
      saleBatch,
      saleAllocation,
      subjectMedia,
      seriesName,
      sireProduct,
      subjectImageKey,
      sireImageKey,
      damImageKey,
      requirements
    };
  }

  private async loadCouplePhotoContext(tenantId: string, femaleProductId: string): Promise<CouplePhotoContext> {
    const [femaleProduct, tenant] = await Promise.all([
      this.findProductOrThrow(tenantId, femaleProductId),
      this.prisma.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          name: true
        }
      })
    ]);

    if ((femaleProduct.sex ?? '').toLowerCase() !== 'female') {
      throw new BadRequestException('Only female breeders can generate couple photos.');
    }

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const mateCode = await this.resolveCurrentMateCode(tenantId, femaleProduct);
    if (!mateCode) {
      throw new BadRequestException('Current female breeder does not have a valid mate code.');
    }

    const maleProduct = await this.findProductByCode(tenantId, mateCode);
    if (!maleProduct) {
      throw new BadRequestException(`Mate code ${mateCode} does not match an existing male breeder.`);
    }

    if ((maleProduct.sex ?? '').toLowerCase() !== 'male') {
      throw new BadRequestException(`Mate code ${mateCode} does not reference a male breeder.`);
    }

    const [seriesName, femaleImageKey, maleImageKey] = await Promise.all([
      this.resolveSeriesName(tenantId, femaleProduct.seriesId),
      this.findMainImageKey(tenantId, femaleProduct.id),
      this.findMainImageKey(tenantId, maleProduct.id)
    ]);

    return {
      tenantId,
      tenantName: tenant.name,
      femaleProduct,
      maleProduct,
      seriesName,
      femaleImageKey,
      maleImageKey
    };
  }

  private async renderCertificateImage(input: {
    context: CertificateLineageContext;
    actorUserId: string;
    issuedAt: Date;
    certNo: string;
    verifyId: string;
    templateVersion: string;
    buyerName?: string;
    buyerAccountId?: string;
  }): Promise<Buffer> {
    const [subjectImage, sireImage, damImage, issuer] = await Promise.all([
      this.loadManagedImageBuffer(input.context.tenantId, input.context.subjectImageKey),
      this.loadManagedImageBuffer(input.context.tenantId, input.context.sireImageKey),
      this.loadManagedImageBuffer(input.context.tenantId, input.context.damImageKey),
      this.resolveIssuerInfo(input.actorUserId)
    ]);

    const style = {
      certNo: input.certNo,
      issuedOnText: this.formatDateYmd(input.issuedAt),
      issuedOnChineseText: this.formatDateChinese(input.issuedAt),
      lineName:
        input.context.saleBatch?.batchNo || input.context.product.name?.trim() || input.context.product.code,
      lineCode: input.context.saleBatch?.batchNo || input.context.product.code,
      lineFamily: input.context.seriesName ?? '未设定',
      damName: input.context.product.name?.trim() || input.context.product.code || '未登记',
      damCode: input.context.product.code || '未登记',
      sireCode: input.context.sireProduct?.code || input.context.saleBatch?.sireCodeSnapshot || '未登记',
      damCodeValue: input.context.product.code || '未登记',
      sireSireCode: input.context.sireProduct?.sireCode || '未登记',
      sireDamCode: input.context.sireProduct?.damCode || '未登记',
      damSireCode: input.context.product.sireCode || '未登记',
      damDamCode: input.context.product.damCode || '未登记',
      buyerName: input.context.saleAllocation?.buyerName || input.buyerName?.trim() || '未登记',
      buyerAccountId:
        input.context.saleAllocation?.buyerAccountId || input.buyerAccountId?.trim() || '未填写',
      sellerName: issuer.name,
      sellerAccountId: issuer.id,
      verifyId: input.verifyId,
      watermarkText: this.buildWatermarkText(input.context.tenantName)
    };

    return renderCertificatePng({
      style,
      verifyUrl: this.buildPublicVerifyUrl(input.verifyId),
      subjectImage,
      sireImage,
      damImage
    });
  }

  private buildEligibilityReasons(
    requirements: ProductCertificateEligibilityRequirements,
    quota?: CertificateQuota
  ): string[] {
    const reasons: string[] = [];

    if (!requirements.hasSireCode) {
      reasons.push('缺少父本编号（sireCode）。');
    }

    if (!requirements.hasDamCode) {
      reasons.push('缺少母本编号（damCode）。');
    }

    if (!requirements.hasParentGrandparentTrace) {
      reasons.push('父系或母系至少需要一侧具备祖代追溯信息。');
    }

    if (quota && quota.remaining <= 0) {
      reasons.push(`当月证书额度已用完（${quota.used}/${quota.limit}）。`);
    }

    return reasons;
  }

  private assertCertificateLineageEligible(requirements: ProductCertificateEligibilityRequirements): void {
    const reasons = this.buildEligibilityReasons(requirements);
    if (reasons.length === 0) {
      return;
    }

    throw new BadRequestException({
      message: 'Product is not eligible for certificate generation.',
      errorCode: ErrorCode.ProductCertificateEligibilityFailed,
      data: {
        reasons,
        requirements
      }
    });
  }

  private buildLineageSnapshot(context: CertificateLineageContext): Prisma.JsonObject {
    return {
      generatedAt: new Date().toISOString(),
      template: DEFAULT_CERTIFICATE_TEMPLATE_VERSION,
      female: {
        id: context.product.id,
        code: context.product.code,
        name: context.product.name,
        sex: context.product.sex,
        seriesId: context.product.seriesId,
        seriesName: context.seriesName
      },
      male: context.sireProduct
        ? {
            id: context.sireProduct.id,
            code: context.sireProduct.code,
            name: context.sireProduct.name,
            sireCode: context.sireProduct.sireCode,
            damCode: context.sireProduct.damCode
          }
        : {
            code: context.saleBatch?.sireCodeSnapshot ?? null
          },
      batch: context.saleBatch
        ? {
            id: context.saleBatch.id,
            batchNo: context.saleBatch.batchNo,
            eggEventId: context.saleBatch.eggEventId,
            eventDateSnapshot: context.saleBatch.eventDateSnapshot.toISOString(),
            eggCountSnapshot: context.saleBatch.eggCountSnapshot,
            plannedQuantity: context.saleBatch.plannedQuantity,
            soldQuantity: context.saleBatch.soldQuantity
          }
        : null,
      grandparents: {
        sireSireCode: context.sireProduct?.sireCode ?? null,
        sireDamCode: context.sireProduct?.damCode ?? null,
        damSireCode: context.product.sireCode ?? null,
        damDamCode: context.product.damCode ?? null
      }
    };
  }

  private buildSaleSnapshot(context: CertificateLineageContext): Prisma.JsonObject | null {
    if (!context.saleBatch && !context.saleAllocation && !context.subjectMedia) {
      return null;
    }

    return {
      batch: context.saleBatch
        ? {
            id: context.saleBatch.id,
            batchNo: context.saleBatch.batchNo,
            status: context.saleBatch.status,
            plannedQuantity: context.saleBatch.plannedQuantity,
            soldQuantity: context.saleBatch.soldQuantity,
            eventDateSnapshot: context.saleBatch.eventDateSnapshot.toISOString(),
            eggCountSnapshot: context.saleBatch.eggCountSnapshot,
            priceLow: this.decimalToNumber(context.saleBatch.priceLow),
            priceHigh: this.decimalToNumber(context.saleBatch.priceHigh)
          }
        : null,
      allocation: context.saleAllocation
        ? {
            id: context.saleAllocation.id,
            allocationNo: context.saleAllocation.allocationNo,
            buyerName: context.saleAllocation.buyerName,
            buyerAccountId: context.saleAllocation.buyerAccountId,
            buyerContact: context.saleAllocation.buyerContact,
            quantity: context.saleAllocation.quantity,
            unitPrice: this.decimalToNumber(context.saleAllocation.unitPrice),
            channel: context.saleAllocation.channel,
            campaignId: context.saleAllocation.campaignId,
            soldAt: context.saleAllocation.soldAt.toISOString()
          }
        : null,
      subjectMedia: context.subjectMedia
        ? {
            id: context.subjectMedia.id,
            label: context.subjectMedia.label,
            isPrimary: context.subjectMedia.isPrimary
          }
        : null
    };
  }

  private buildWatermarkSnapshot(tenantName: string): Prisma.JsonObject {
    return {
      platformTemplate: 'merchant.only',
      tenantName,
      watermarkText: this.buildWatermarkText(tenantName)
    };
  }

  private buildWatermarkText(tenantName: string): string {
    return `${tenantName} · 珍藏证书`;
  }

  private async resolveIssuerInfo(userId: string): Promise<{ name: string; id: string }> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        name: true,
        account: true,
        email: true
      }
    });

    if (!user) {
      return {
        name: '未登记用户',
        id: userId
      };
    }

    const displayName = user.name?.trim() || user.account?.trim() || user.email.split('@')[0] || '未登记用户';
    return {
      name: displayName,
      id: user.id
    };
  }

  private async getCertificateQuota(tenantId: string, monthKey = this.getMonthKey(new Date())): Promise<CertificateQuota> {
    const row = await this.prisma.tenantCertificateQuotaMonthly.findUnique({
      where: {
        tenantId_monthKey: {
          tenantId,
          monthKey
        }
      },
      select: {
        usedCount: true
      }
    });

    return this.buildQuota(monthKey, row?.usedCount ?? 0);
  }

  private async consumeCertificateQuota(
    tx: Prisma.TransactionClient,
    tenantId: string,
    monthKey: string
  ): Promise<CertificateQuota> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await tx.tenantCertificateQuotaMonthly.findUnique({
        where: {
          tenantId_monthKey: {
            tenantId,
            monthKey
          }
        },
        select: {
          usedCount: true
        }
      });

      if (!existing) {
        try {
          await tx.tenantCertificateQuotaMonthly.create({
            data: {
              tenantId,
              monthKey,
              usedCount: 1
            }
          });

          return this.buildQuota(monthKey, 1);
        } catch (error) {
          if (this.isQuotaConflict(error)) {
            continue;
          }
          throw error;
        }
      }

      const updated = await tx.tenantCertificateQuotaMonthly.updateMany({
        where: {
          tenantId,
          monthKey,
          usedCount: {
            lt: CERTIFICATE_MONTHLY_LIMIT
          }
        },
        data: {
          usedCount: {
            increment: 1
          }
        }
      });

      if (updated.count === 1) {
        const refreshed = await tx.tenantCertificateQuotaMonthly.findUnique({
          where: {
            tenantId_monthKey: {
              tenantId,
              monthKey
            }
          },
          select: {
            usedCount: true
          }
        });

        return this.buildQuota(monthKey, refreshed?.usedCount ?? CERTIFICATE_MONTHLY_LIMIT);
      }

      throw new ForbiddenException({
        message: 'Monthly certificate quota exceeded.',
        errorCode: ErrorCode.ProductCertificateQuotaExceeded
      });
    }

    throw new ConflictException('Failed to consume certificate quota. Please retry.');
  }

  private async resolveStoredBinary(
    tenantId: string,
    key: string,
    url: string,
    options: {
      notFoundMessage: string;
      errorCode: string;
      contentType: string | null;
    }
  ): Promise<StoredContentResult> {
    if (!this.isManagedStorageKey(tenantId, key)) {
      const redirectUrl = (url ?? '').trim();
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        throw new NotFoundException({
          message: options.notFoundMessage,
          errorCode: options.errorCode
        });
      }

      return {
        redirectUrl,
        contentType: options.contentType
      };
    }

    try {
      const object = await this.storageProvider.getObject(key);
      return {
        content: object.body,
        contentType: options.contentType ?? object.contentType
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          message: options.notFoundMessage,
          errorCode: options.errorCode
        });
      }

      throw error;
    }
  }

  private async loadManagedImageBuffer(tenantId: string, key: string | null): Promise<Buffer | null> {
    if (!key || !this.isManagedStorageKey(tenantId, key)) {
      return null;
    }

    try {
      const object = await this.storageProvider.getObject(key);
      return object.body;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }

      throw error;
    }
  }

  private toProductCertificate(row: PrismaProductCertificateModel): ProductCertificate {
    return {
      id: row.id,
      tenantId: row.tenantId,
      productId: row.productId,
      eggEventId: row.eggEventId,
      saleBatchId: row.saleBatchId,
      saleAllocationId: row.saleAllocationId,
      subjectMediaId: row.subjectMediaId,
      previousCertificateId: row.previousCertificateId,
      versionNo: row.versionNo,
      voidReason: row.voidReason,
      certNo: row.certNo,
      verifyId: row.verifyId,
      status: row.status as ProductCertificate['status'],
      templateVersion: row.templateVersion,
      lineageSnapshot: row.lineageSnapshot,
      saleSnapshot: row.saleSnapshot,
      watermarkSnapshot: row.watermarkSnapshot,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes.toString(),
      contentPath: this.buildCertificateContentPath(row.productId, row.id),
      issuedAt: row.issuedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toProductCertificateCenterItem(
    row: PrismaProductCertificateModel & {
      product: { code: string; name: string | null };
      saleBatch: PrismaSaleBatchModel | null;
      saleAllocation: PrismaSaleAllocationModel | null;
      subjectMedia: PrismaSaleSubjectMediaModel | null;
      eggEvent: { eventDate: Date } | null;
    }
  ): ProductCertificateCenterItem {
    return {
      certificate: this.toProductCertificate(row),
      femaleCode: row.product.code,
      productName: row.product.name,
      batchNo: row.saleBatch?.batchNo ?? null,
      allocationNo: row.saleAllocation?.allocationNo ?? null,
      buyerName: row.saleAllocation?.buyerName ?? null,
      channel: row.saleAllocation?.channel ?? null,
      subjectContentPath: row.subjectMedia
        ? this.buildSaleSubjectMediaContentPath(row.subjectMedia.saleBatchId, row.subjectMedia.id)
        : null,
      eggEventDate: row.eggEvent?.eventDate ? row.eggEvent.eventDate.toISOString() : null
    };
  }

  private toProductCouplePhoto(row: PrismaProductCouplePhotoModel): ProductCouplePhoto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      femaleProductId: row.femaleProductId,
      maleProductIdSnapshot: row.maleProductIdSnapshot,
      femaleCodeSnapshot: row.femaleCodeSnapshot,
      maleCodeSnapshot: row.maleCodeSnapshot,
      templateVersion: row.templateVersion,
      watermarkSnapshot: row.watermarkSnapshot,
      priceSnapshot: row.priceSnapshot !== null ? row.priceSnapshot.toNumber() : null,
      isCurrent: row.isCurrent,
      staleReason: row.staleReason,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes.toString(),
      contentPath: this.buildCouplePhotoContentPath(row.femaleProductId, row.id),
      generatedAt: row.generatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toSaleAllocation(row: PrismaSaleAllocationModel): SaleAllocation {
    return {
      id: row.id,
      tenantId: row.tenantId,
      saleBatchId: row.saleBatchId,
      allocationNo: row.allocationNo,
      status: row.status as SaleAllocation['status'],
      quantity: row.quantity,
      buyerName: row.buyerName,
      buyerAccountId: row.buyerAccountId,
      buyerContact: row.buyerContact,
      unitPrice: this.decimalToNumber(row.unitPrice),
      channel: row.channel,
      campaignId: row.campaignId,
      note: row.note,
      soldAt: row.soldAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toSaleSubjectMedia(row: PrismaSaleSubjectMediaModel): SaleSubjectMedia {
    return {
      id: row.id,
      tenantId: row.tenantId,
      femaleProductId: row.femaleProductId,
      saleBatchId: row.saleBatchId,
      label: row.label,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes.toString(),
      isPrimary: row.isPrimary,
      contentPath: this.buildSaleSubjectMediaContentPath(row.saleBatchId, row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private toSaleBatch(
    row: PrismaSaleBatchModel & {
      allocations: PrismaSaleAllocationModel[];
      subjectMedia: PrismaSaleSubjectMediaModel[];
    }
  ): SaleBatch {
    return {
      id: row.id,
      tenantId: row.tenantId,
      femaleProductId: row.femaleProductId,
      eggEventId: row.eggEventId,
      batchNo: row.batchNo,
      status: row.status as SaleBatch['status'],
      plannedQuantity: row.plannedQuantity,
      soldQuantity: row.soldQuantity,
      remainingQuantity: Math.max(0, row.plannedQuantity - row.soldQuantity),
      eventDateSnapshot: row.eventDateSnapshot.toISOString(),
      eggCountSnapshot: row.eggCountSnapshot,
      femaleCodeSnapshot: row.femaleCodeSnapshot,
      sireCodeSnapshot: row.sireCodeSnapshot,
      seriesNameSnapshot: row.seriesNameSnapshot,
      priceLow: this.decimalToNumber(row.priceLow),
      priceHigh: this.decimalToNumber(row.priceHigh),
      note: row.note,
      allocations: row.allocations.map((item) => this.toSaleAllocation(item)),
      subjectMedia: row.subjectMedia.map((item) => this.toSaleSubjectMedia(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private async findProductOrThrow(tenantId: string, productId: string): Promise<PrismaProduct> {
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

  private async findProductByCode(tenantId: string, code: string | null): Promise<PrismaProduct | null> {
    const normalized = this.normalizeOptionalCode(code);
    if (!normalized) {
      return null;
    }

    return this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalized,
          mode: 'insensitive'
        }
      }
    });
  }

  private async findSaleBatchOrThrow(
    tenantId: string,
    saleBatchId: string,
    scope?: { femaleProductId?: string; eggEventId?: string }
  ): Promise<PrismaSaleBatchModel> {
    const batch = await this.prisma.saleBatch.findFirst({
      where: {
        id: saleBatchId,
        tenantId,
        femaleProductId: scope?.femaleProductId,
        eggEventId: scope?.eggEventId
      }
    });

    if (!batch) {
      throw new NotFoundException({
        message: 'Sale batch not found.',
        errorCode: ErrorCode.SaleBatchNotFound
      });
    }

    return batch;
  }

  private async findSaleAllocationOrThrow(
    tenantId: string,
    saleAllocationId: string
  ): Promise<PrismaSaleAllocationModel> {
    const allocation = await this.prisma.saleAllocation.findFirst({
      where: {
        id: saleAllocationId,
        tenantId
      }
    });

    if (!allocation) {
      throw new NotFoundException({
        message: 'Sale allocation not found.',
        errorCode: ErrorCode.SaleAllocationNotFound
      });
    }

    return allocation;
  }

  private async findSaleSubjectMediaOrThrow(
    tenantId: string,
    subjectMediaId: string
  ): Promise<PrismaSaleSubjectMediaModel> {
    const media = await this.prisma.saleSubjectMedia.findFirst({
      where: {
        id: subjectMediaId,
        tenantId
      }
    });

    if (!media) {
      throw new NotFoundException({
        message: 'Sale subject media not found.',
        errorCode: ErrorCode.SaleSubjectMediaNotFound
      });
    }

    return media;
  }

  private async findReissuableCertificateOrThrow(
    tenantId: string,
    certificateId: string
  ): Promise<PrismaProductCertificateModel> {
    const certificate = await this.prisma.productCertificate.findFirst({
      where: {
        id: certificateId,
        tenantId
      }
    });

    if (!certificate) {
      throw new NotFoundException({
        message: 'Product certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      });
    }

    if (certificate.status !== 'ISSUED') {
      throw new BadRequestException({
        message: 'Only issued certificates can be reissued.',
        errorCode: ErrorCode.ProductCertificateAlreadyVoid
      });
    }

    return certificate;
  }

  private buildReissueGeneratePayload(
    certificate: Pick<
      PrismaProductCertificateModel,
      'eggEventId' | 'saleBatchId' | 'saleAllocationId' | 'subjectMediaId' | 'templateVersion'
    >,
    payload: ReissueProductCertificateRequest
  ): ProductCertificateGenerateRequest {
    const eggEventId = certificate.eggEventId?.trim();
    const saleBatchId = certificate.saleBatchId?.trim();
    const saleAllocationId = certificate.saleAllocationId?.trim();
    const subjectMediaId = payload.subjectMediaId?.trim() || certificate.subjectMediaId?.trim();

    if (!eggEventId || !saleBatchId || !saleAllocationId || !subjectMediaId) {
      throw new BadRequestException({
        message: 'Only sale-linked certificates can be reissued.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    return {
      eggEventId,
      saleBatchId,
      saleAllocationId,
      subjectMediaId,
      templateVersion: payload.templateVersion?.trim() || certificate.templateVersion
    };
  }

  private async findMainImageKey(tenantId: string, productId: string): Promise<string | null> {
    const image = await this.prisma.productImage.findFirst({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        key: true
      }
    });

    return image?.key ?? null;
  }

  private async findMainImageKeyByCode(tenantId: string, code: string): Promise<string | null> {
    const product = await this.findProductByCode(tenantId, code);
    if (!product) {
      return null;
    }

    return this.findMainImageKey(tenantId, product.id);
  }

  private async resolveSeriesName(tenantId: string, seriesId: string | null): Promise<string | null> {
    if (!seriesId) {
      return null;
    }

    const series = await this.prisma.series.findFirst({
      where: {
        id: seriesId,
        tenantId
      },
      select: {
        name: true
      }
    });

    return series?.name ?? null;
  }

  private async resolveCurrentMateCode(tenantId: string, product: PrismaProduct): Promise<string | null> {
    const explicit = this.normalizeOptionalCode(product.mateCode);
    if (explicit) {
      return explicit;
    }

    const fromDescription = this.normalizeOptionalCode(parseCurrentMateCode(product.description));
    if (fromDescription) {
      return fromDescription;
    }

    const latestMating = await this.prisma.productEvent.findFirst({
      where: {
        tenantId,
        productId: product.id,
        eventType: 'mating'
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    if (!latestMating) {
      return null;
    }

    return this.normalizeOptionalCode(parseTaggedProductEventNote(latestMating.note).maleCode);
  }

  private normalizeOptionalCode(value: string | null | undefined): string | null {
    return normalizeCodeUpper(value);
  }

  private buildCertificateNo(productCode: string, issuedAt: Date): string {
    const y = issuedAt.getFullYear();
    const m = String(issuedAt.getMonth() + 1).padStart(2, '0');
    const d = String(issuedAt.getDate()).padStart(2, '0');
    const compactCode = productCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'PRODUCT';
    const suffix = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 6);
    return `CERT-${y}${m}${d}-${compactCode}-${suffix}`;
  }

  private buildVerifyId(): string {
    return randomUUID().replace(/-/g, '').toUpperCase().slice(0, 32);
  }

  private getMonthKey(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }

  private buildQuota(monthKey: string, used: number): CertificateQuota {
    const safeUsed = Math.max(0, used);
    return {
      monthKey,
      limit: CERTIFICATE_MONTHLY_LIMIT,
      used: safeUsed,
      remaining: Math.max(0, CERTIFICATE_MONTHLY_LIMIT - safeUsed)
    };
  }

  private buildCertificateStorageKey(tenantId: string, productId: string): string {
    return `${tenantId}/products/${productId}/certificates/${Date.now()}-${randomUUID()}.png`;
  }

  private buildSaleSubjectMediaStorageKey(tenantId: string, productId: string, originalName: string, mimeType: string): string {
    const extension = this.getFileExtension(originalName, mimeType);
    return `${tenantId}/products/${productId}/sale-subject-media/${Date.now()}-${randomUUID()}${extension}`;
  }

  private buildCouplePhotoStorageKey(tenantId: string, productId: string): string {
    return `${tenantId}/products/${productId}/couple-photos/${Date.now()}-${randomUUID()}.png`;
  }

  private buildCertificateContentPath(productId: string, certificateId: string): string {
    return `/products/${productId}/certificates/${certificateId}/content`;
  }

  private buildCouplePhotoContentPath(femaleProductId: string, photoId: string): string {
    return `/products/${femaleProductId}/couple-photos/${photoId}/content`;
  }

  private buildSaleSubjectMediaContentPath(saleBatchId: string, mediaId: string): string {
    return `/public/sale-batches/${saleBatchId}/subject-media/${mediaId}/content`;
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

  private buildPublicVerifyPath(verifyId: string): string {
    return `/public/certificates/verify/${verifyId}`;
  }

  private buildPublicVerifyUrl(verifyId: string): string {
    const path = this.buildPublicVerifyPath(verifyId);
    const baseUrl = (process.env.PUBLIC_VERIFY_BASE_URL ?? process.env.PUBLIC_WEB_BASE_URL ?? '')
      .trim()
      .replace(/\/+$/, '');
    if (!baseUrl) {
      return path;
    }

    return `${baseUrl}${path}`;
  }

  private buildPublicCertificateContentPath(verifyId: string): string {
    return `/public/certificates/verify/${verifyId}/content`;
  }

  private formatDateYmd(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateChinese(value: Date): string {
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();
    return `${year}年${month}月${day}日`;
  }

  private formatDateTime(value: Date): string {
    const date = this.formatDateYmd(value);
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${date} ${hh}:${mm}`;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value.toNumber();
  }

  private buildSaleBatchNo(productCode: string, eventDate: Date): string {
    const compactCode = productCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'BATCH';
    return `BATCH-${this.formatDateYmd(eventDate).replace(/-/g, '')}-${compactCode}-${randomUUID()
      .replace(/-/g, '')
      .toUpperCase()
      .slice(0, 4)}`;
  }

  private buildSaleAllocationNo(batchNo: string): string {
    return `ALLOC-${batchNo.slice(-12)}-${randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)}`;
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalized.startsWith(`${tenantId}/`);
  }

  private isQuotaConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('tenant_id') && target.includes('month_key');
  }

  private isCertificateConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('verify_id') || target.includes('cert_no');
  }
}
