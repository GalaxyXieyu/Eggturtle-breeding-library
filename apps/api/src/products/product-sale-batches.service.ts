import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditAction, ErrorCode } from '@eggturtle/shared'
import type {
  CreateSaleAllocationRequest,
  CreateSaleBatchRequest,
  CreateSaleSubjectMediaRequest,
  SaleAllocation,
  SaleBatch,
  SaleSubjectMedia
} from '@eggturtle/shared'
import type {
  SaleAllocation as PrismaSaleAllocationModel,
  SaleBatch as PrismaSaleBatchModel,
  SaleSubjectMedia as PrismaSaleSubjectMediaModel
} from '@prisma/client'
import { randomUUID } from 'node:crypto'

import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { PrismaService } from '../prisma.service'

import { ProductGeneratedAssetsSupportService, type StoredContentResult } from './product-generated-assets-support.service'
import { parseTaggedProductEventNote } from './product-event-utils'

export type UploadedBinaryFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

@Injectable()
export class ProductSaleBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly generatedAssetsSupportService: ProductGeneratedAssetsSupportService
  ) {}

  async listSaleBatches(tenantId: string, femaleProductId: string): Promise<{ items: SaleBatch[] }> {
    await this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId)

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
    })

    return {
      items: rows.map((row) => this.toSaleBatch(row))
    }
  }

  async createSaleBatch(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: CreateSaleBatchRequest
  ): Promise<{ batch: SaleBatch }> {
    const femaleProduct = await this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId)
    if ((femaleProduct.sex ?? '').toLowerCase() !== 'female') {
      throw new BadRequestException('Only female breeders can create sale batches.')
    }

    const eggEvent = await this.prisma.productEvent.findFirst({
      where: {
        id: payload.eggEventId,
        tenantId,
        productId: femaleProductId,
        eventType: 'egg'
      }
    })

    if (!eggEvent) {
      throw new NotFoundException({
        message: 'Egg event not found for selected female breeder.',
        errorCode: ErrorCode.SaleBatchNotFound
      })
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
    })

    const sireCode = this.generatedAssetsSupportService.normalizeOptionalCode(
      parseTaggedProductEventNote(latestMating?.note ?? null).maleCode
    )
    if (!sireCode) {
      throw new BadRequestException({
        message: 'Unable to lock sire from the selected egg event.',
        errorCode: ErrorCode.SaleBatchEventMismatch
      })
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
    })

    if (existingBatch) {
      return {
        batch: this.toSaleBatch(existingBatch)
      }
    }

    const seriesName = await this.generatedAssetsSupportService.resolveSeriesName(tenantId, femaleProduct.seriesId)
    const eggCountSnapshot = parseTaggedProductEventNote(eggEvent.note).eggCount ?? null
    const batchNo = this.buildSaleBatchNo(femaleProduct.code, eggEvent.eventDate)
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
    })

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
    })

    return {
      batch: this.toSaleBatch(created)
    }
  }

  async createSaleAllocation(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: CreateSaleAllocationRequest
  ): Promise<{ allocation: SaleAllocation; batch: SaleBatch }> {
    await this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId)
    const batch = await this.generatedAssetsSupportService.findSaleBatchOrThrow(tenantId, payload.saleBatchId, {
      femaleProductId
    })
    const remaining = Math.max(0, batch.plannedQuantity - batch.soldQuantity)
    if (payload.quantity > remaining) {
      throw new BadRequestException({
        message: `Only ${remaining} items remain in this batch.`,
        errorCode: ErrorCode.SaleBatchQuantityExceeded
      })
    }

    const allocationNo = this.buildSaleAllocationNo(batch.batchNo)
    const soldAt = payload.soldAt ? new Date(payload.soldAt) : new Date()
    const unitPrice = payload.unitPrice ?? null
    const nextPriceLow =
      unitPrice === null
        ? batch.priceLow
        : batch.priceLow === null
          ? unitPrice
          : Math.min(batch.priceLow.toNumber(), unitPrice)
    const nextPriceHigh =
      unitPrice === null
        ? batch.priceHigh
        : batch.priceHigh === null
          ? unitPrice
          : Math.max(batch.priceHigh.toNumber(), unitPrice)
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
      })

      const soldQuantity = batch.soldQuantity + payload.quantity
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
      })

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
      })

      return {
        allocation: created,
        batch: refreshedBatch
      }
    })

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
    })

    return {
      allocation: this.toSaleAllocation(result.allocation),
      batch: this.toSaleBatch(result.batch)
    }
  }

  async uploadSaleSubjectMedia(
    tenantId: string,
    actorUserId: string,
    femaleProductId: string,
    payload: CreateSaleSubjectMediaRequest,
    file: UploadedBinaryFile
  ): Promise<{ media: SaleSubjectMedia; batch: SaleBatch }> {
    await this.generatedAssetsSupportService.findProductOrThrow(tenantId, femaleProductId)
    const batch = await this.generatedAssetsSupportService.findSaleBatchOrThrow(tenantId, payload.saleBatchId, {
      femaleProductId
    })

    const key = this.generatedAssetsSupportService.buildSaleSubjectMediaStorageKey(
      tenantId,
      femaleProductId,
      file.originalname,
      file.mimetype
    )
    const contentType = file.mimetype?.trim() || 'application/octet-stream'
    let uploadResult: { key: string; url: string; contentType: string | null } | null = null

    try {
      uploadResult = await this.generatedAssetsSupportService.putObject({
        key,
        body: file.buffer,
        contentType,
        metadata: {
          tenantId,
          femaleProductId,
          saleBatchId: batch.id,
          source: 'sale.subject_media'
        }
      })

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
          })
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
        })

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
        })

        return {
          media: created,
          batch: refreshedBatch
        }
      })

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
      })

      return {
        media: this.toSaleSubjectMedia(result.media),
        batch: this.toSaleBatch(result.batch)
      }
    } catch (error) {
      if (uploadResult?.key) {
        await this.generatedAssetsSupportService.deleteObject(uploadResult.key).catch(() => undefined)
      }
      throw error
    }
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
    })

    if (!media) {
      throw new NotFoundException({
        message: 'Sale subject media not found.',
        errorCode: ErrorCode.SaleSubjectMediaNotFound
      })
    }

    return this.generatedAssetsSupportService.resolveStoredBinary(media.tenantId, media.imageKey, media.imageUrl, {
      notFoundMessage: 'Sale subject media content not found.',
      errorCode: ErrorCode.SaleSubjectMediaNotFound,
      contentType: media.contentType
    })
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
      unitPrice: this.generatedAssetsSupportService.decimalToNumber(row.unitPrice),
      channel: row.channel,
      campaignId: row.campaignId,
      note: row.note,
      soldAt: row.soldAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
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
      contentPath: this.generatedAssetsSupportService.buildSaleSubjectMediaContentPath(row.saleBatchId, row.id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  private toSaleBatch(
    row: PrismaSaleBatchModel & {
      allocations: PrismaSaleAllocationModel[]
      subjectMedia: PrismaSaleSubjectMediaModel[]
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
      priceLow: this.generatedAssetsSupportService.decimalToNumber(row.priceLow),
      priceHigh: this.generatedAssetsSupportService.decimalToNumber(row.priceHigh),
      note: row.note,
      allocations: row.allocations.map((item) => this.toSaleAllocation(item)),
      subjectMedia: row.subjectMedia.map((item) => this.toSaleSubjectMedia(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  private buildSaleBatchNo(productCode: string, eventDate: Date): string {
    const compactCode = productCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) || 'BATCH'
    return `BATCH-${this.generatedAssetsSupportService.formatDateYmd(eventDate).replace(/-/g, '')}-${compactCode}-${randomUUID()
      .replace(/-/g, '')
      .toUpperCase()
      .slice(0, 4)}`
  }

  private buildSaleAllocationNo(batchNo: string): string {
    return `ALLOC-${batchNo.slice(-12)}-${randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)}`
  }
}
