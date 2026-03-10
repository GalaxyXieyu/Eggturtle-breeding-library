import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ErrorCode } from '@eggturtle/shared'
import { Prisma } from '@prisma/client'
import type {
  Product as PrismaProduct,
  SaleAllocation as PrismaSaleAllocationModel,
  SaleBatch as PrismaSaleBatchModel,
  SaleSubjectMedia as PrismaSaleSubjectMediaModel
} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { PrismaService } from '../prisma.service'
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants'
import type { PutObjectInput, PutObjectResult, StorageProvider } from '../storage/storage.provider'

import { normalizeCodeUpper, parseCurrentMateCode } from './breeding-rules'
import { parseTaggedProductEventNote } from './product-event-utils'

export type StoredContentResult =
  | {
      content: Buffer
      contentType: string | null
    }
  | {
      redirectUrl: string
      contentType: string | null
    }

@Injectable()
export class ProductGeneratedAssetsSupportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async resolveStoredBinary(
    tenantId: string,
    key: string,
    url: string,
    options: {
      notFoundMessage: string
      errorCode: string
      contentType: string | null
    }
  ): Promise<StoredContentResult> {
    if (!this.isManagedStorageKey(tenantId, key)) {
      const redirectUrl = (url ?? '').trim()
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        throw new NotFoundException({
          message: options.notFoundMessage,
          errorCode: options.errorCode
        })
      }

      return {
        redirectUrl,
        contentType: options.contentType
      }
    }

    try {
      const object = await this.storageProvider.getObject(key)
      return {
        content: object.body,
        contentType: options.contentType ?? object.contentType
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          message: options.notFoundMessage,
          errorCode: options.errorCode
        })
      }

      throw error
    }
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    return this.storageProvider.putObject(input)
  }

  async deleteObject(key: string): Promise<void> {
    await this.storageProvider.deleteObject(key)
  }

  async loadManagedImageBuffer(tenantId: string, key: string | null): Promise<Buffer | null> {
    if (!key || !this.isManagedStorageKey(tenantId, key)) {
      return null
    }

    try {
      const object = await this.storageProvider.getObject(key)
      return object.body
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null
      }

      throw error
    }
  }

  async findProductOrThrow(tenantId: string, productId: string): Promise<PrismaProduct> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId
      }
    })

    if (!product) {
      throw new NotFoundException({
        message: '未找到产品。',
        errorCode: ErrorCode.ProductNotFound
      })
    }

    return product
  }

  async findProductByCode(tenantId: string, code: string | null): Promise<PrismaProduct | null> {
    const normalized = this.normalizeOptionalCode(code)
    if (!normalized) {
      return null
    }

    return this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalized,
          mode: 'insensitive'
        }
      }
    })
  }

  async findSaleBatchOrThrow(
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
    })

    if (!batch) {
      throw new NotFoundException({
        message: '未找到销售批次。',
        errorCode: ErrorCode.SaleBatchNotFound
      })
    }

    return batch
  }

  async findSaleAllocationOrThrow(
    tenantId: string,
    saleAllocationId: string
  ): Promise<PrismaSaleAllocationModel> {
    const allocation = await this.prisma.saleAllocation.findFirst({
      where: {
        id: saleAllocationId,
        tenantId
      }
    })

    if (!allocation) {
      throw new NotFoundException({
        message: '未找到成交记录。',
        errorCode: ErrorCode.SaleAllocationNotFound
      })
    }

    return allocation
  }

  async findSaleSubjectMediaOrThrow(
    tenantId: string,
    subjectMediaId: string
  ): Promise<PrismaSaleSubjectMediaModel> {
    const media = await this.prisma.saleSubjectMedia.findFirst({
      where: {
        id: subjectMediaId,
        tenantId
      }
    })

    if (!media) {
      throw new NotFoundException({
        message: '未找到成交主题图。',
        errorCode: ErrorCode.SaleSubjectMediaNotFound
      })
    }

    return media
  }

  async findMainImageKey(tenantId: string, productId: string): Promise<string | null> {
    const image = await this.prisma.productImage.findFirst({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        key: true
      }
    })

    return image?.key ?? null
  }

  async findMainImageKeyByCode(tenantId: string, code: string): Promise<string | null> {
    const product = await this.findProductByCode(tenantId, code)
    if (!product) {
      return null
    }

    return this.findMainImageKey(tenantId, product.id)
  }

  async resolveSeriesSummary(
    tenantId: string,
    seriesId: string | null
  ): Promise<{ name: string | null; description: string | null }> {
    if (!seriesId) {
      return {
        name: null,
        description: null
      }
    }

    const series = await this.prisma.series.findFirst({
      where: {
        id: seriesId,
        tenantId
      },
      select: {
        name: true,
        description: true
      }
    })

    return {
      name: series?.name ?? null,
      description: series?.description?.trim() || null
    }
  }

  async resolveSeriesName(tenantId: string, seriesId: string | null): Promise<string | null> {
    const summary = await this.resolveSeriesSummary(tenantId, seriesId)
    return summary.name
  }

  async resolveCurrentMateCode(tenantId: string, product: PrismaProduct): Promise<string | null> {
    const explicit = this.normalizeOptionalCode(product.mateCode)
    if (explicit) {
      return explicit
    }

    const fromDescription = this.normalizeOptionalCode(parseCurrentMateCode(product.description))
    if (fromDescription) {
      return fromDescription
    }

    const latestMating = await this.prisma.productEvent.findFirst({
      where: {
        tenantId,
        productId: product.id,
        eventType: 'mating'
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    })

    if (!latestMating) {
      return null
    }

    return this.normalizeOptionalCode(parseTaggedProductEventNote(latestMating.note).maleCode)
  }

  normalizeOptionalCode(value: string | null | undefined): string | null {
    return normalizeCodeUpper(value)
  }

  buildCertificateStorageKey(tenantId: string, productId: string): string {
    return `${tenantId}/products/${productId}/certificates/${Date.now()}-${randomUUID()}.png`
  }

  buildSaleSubjectMediaStorageKey(tenantId: string, productId: string, originalName: string, mimeType: string): string {
    const extension = this.getFileExtension(originalName, mimeType)
    return `${tenantId}/products/${productId}/sale-subject-media/${Date.now()}-${randomUUID()}${extension}`
  }

  buildCouplePhotoStorageKey(tenantId: string, productId: string): string {
    return `${tenantId}/products/${productId}/couple-photos/${Date.now()}-${randomUUID()}.png`
  }

  buildCertificateContentPath(productId: string, certificateId: string): string {
    return `/products/${productId}/certificates/${certificateId}/content`
  }

  buildCouplePhotoContentPath(femaleProductId: string, photoId: string): string {
    return `/products/${femaleProductId}/couple-photos/${photoId}/content`
  }

  buildSaleSubjectMediaContentPath(saleBatchId: string, mediaId: string): string {
    return `/public/sale-batches/${saleBatchId}/subject-media/${mediaId}/content`
  }

  buildPublicVerifyPath(verifyId: string): string {
    return `/public/certificates/verify/${verifyId}`
  }

  buildPublicVerifyUrl(verifyId: string): string {
    const verifyPath = this.buildPublicVerifyPath(verifyId)
    const baseUrl = (
      process.env.PUBLIC_VERIFY_BASE_URL ??
      process.env.PUBLIC_WEB_BASE_URL ??
      process.env.NEXT_PUBLIC_PUBLIC_APP_ORIGIN ??
      ''
    )
      .trim()
      .replace(/\/+$/, '')
    if (!baseUrl) {
      return verifyPath
    }

    return `${baseUrl}${verifyPath}`
  }

  buildPublicCertificateContentPath(verifyId: string): string {
    return `/public/certificates/verify/${verifyId}/content`
  }

  formatDateYmd(value: Date): string {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  formatDateChinese(value: Date): string {
    const year = value.getFullYear()
    const month = value.getMonth() + 1
    const day = value.getDate()
    return `${year}年${month}月${day}日`
  }

  formatDateTime(value: Date): string {
    const date = this.formatDateYmd(value)
    const hh = String(value.getHours()).padStart(2, '0')
    const mm = String(value.getMinutes()).padStart(2, '0')
    return `${date} ${hh}:${mm}`
  }

  buildWatermarkText(tenantName: string): string {
    return `${tenantName} · 珍藏证书`
  }

  decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null
    }

    return value.toNumber()
  }

  private getFileExtension(originalName: string, mimeType: string): string {
    const extensionFromName = path.extname(originalName).trim()
    if (extensionFromName) {
      return extensionFromName.toLowerCase()
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    }

    return extensionMap[mimeType] ?? ''
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '')
    return normalized.startsWith(`${tenantId}/`)
  }
}
