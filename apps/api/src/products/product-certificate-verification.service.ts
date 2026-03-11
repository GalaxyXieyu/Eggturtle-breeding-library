import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ErrorCode } from '@eggturtle/shared'
import type {
  ProductCertificate,
  SaleBatch,
  VerifyProductCertificateResponse
} from '@eggturtle/shared'

import { PrismaService } from '../prisma.service'
import { buildWebpVariantKey, resolveAllowedMaxEdge, resizeToWebpMaxEdge } from '../images/image-variants'
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants'
import type { StorageProvider } from '../storage/storage.provider'

import { ProductGeneratedAssetsSupportService, type StoredContentResult } from './product-generated-assets-support.service'

@Injectable()
export class ProductCertificateVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generatedAssetsSupportService: ProductGeneratedAssetsSupportService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

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
    })

    if (!certificate) {
      throw new NotFoundException({
        message: 'Certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      })
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
        contentPath: this.generatedAssetsSupportService.buildPublicCertificateContentPath(certificate.verifyId),
        subjectContentPath: certificate.subjectMedia
          ? this.generatedAssetsSupportService.buildSaleSubjectMediaContentPath(
              certificate.subjectMedia.saleBatchId,
              certificate.subjectMedia.id
            )
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
              priceLow: this.generatedAssetsSupportService.decimalToNumber(certificate.saleBatch.priceLow),
              priceHigh: this.generatedAssetsSupportService.decimalToNumber(certificate.saleBatch.priceHigh)
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
              unitPrice: this.generatedAssetsSupportService.decimalToNumber(certificate.saleAllocation.unitPrice),
              channel: certificate.saleAllocation.channel,
              campaignId: certificate.saleAllocation.campaignId,
              soldAt: certificate.saleAllocation.soldAt.toISOString()
            }
          : null
      }
    }
  }

  async getVerifiedCertificateContent(
    verifyId: string,
    options?: {
      maxEdge?: number
    }
  ): Promise<StoredContentResult> {
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
    })

    if (!certificate) {
      throw new NotFoundException({
        message: 'Certificate not found.',
        errorCode: ErrorCode.ProductCertificateNotFound
      })
    }

    const maxEdge = resolveAllowedMaxEdge(options?.maxEdge)
    if (!this.isManagedStorageKey(certificate.tenantId, certificate.imageKey)) {
      const redirectUrl = (certificate.imageUrl ?? '').trim()
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        throw new NotFoundException({
          message: 'Certificate content not found.',
          errorCode: ErrorCode.ProductCertificateNotFound
        })
      }

      return {
        redirectUrl,
        contentType: certificate.contentType
      }
    }

    try {
      if (maxEdge) {
        const variantKey = buildWebpVariantKey(certificate.imageKey, maxEdge)
        try {
          const variantObject = await this.storageProvider.getObject(variantKey)
          return {
            content: variantObject.body,
            contentType: variantObject.contentType ?? certificate.contentType
          }
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            throw error
          }
        }
      }

      const storedObject = await this.storageProvider.getObject(certificate.imageKey)
      const resized = maxEdge ? await resizeToWebpMaxEdge({ body: storedObject.body, maxEdge }) : null

      if (maxEdge && resized) {
        const variantKey = buildWebpVariantKey(certificate.imageKey, maxEdge)
        void this.storageProvider
          .putObject({
            key: variantKey,
            body: resized.body,
            contentType: resized.contentType,
            metadata: {
              source: 'product-certificate-public-variant',
              originalKey: certificate.imageKey,
              maxEdge: String(maxEdge)
            }
          })
          .catch(() => undefined)
      }

      return {
        content: resized?.body ?? storedObject.body,
        contentType: resized?.contentType ?? certificate.contentType ?? storedObject.contentType
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          message: 'Certificate content not found.',
          errorCode: ErrorCode.ProductCertificateNotFound
        })
      }

      throw error
    }
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '')
    return normalized.startsWith(`${tenantId}/`)
  }
}
