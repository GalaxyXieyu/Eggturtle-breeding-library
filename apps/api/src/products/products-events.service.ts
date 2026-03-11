import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  ProductEvent,
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type {
  Product as PrismaProduct,
  ProductEvent as PrismaProductEvent,
  SaleBatch as PrismaSaleBatch,
} from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';

import {
  buildTaggedNote,
  normalizeCodeUpper,
  parseEventDateInput,
} from './breeding-rules';
import {
  PRODUCT_EVENT_MUTABLE_FIELDS,
  type ProductEventType,
} from './products-events.constants';
import { parseTaggedProductEventNote } from './product-event-utils';
import type {
  CreateEggRecordInput,
  CreateMatingRecordInput,
  CreateProductEventInput,
  UpdateProductEventInput,
} from './products.types';

@Injectable()
export class ProductsEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createMatingRecord(
    tenantId: string,
    actorUserId: string,
    payload: CreateMatingRecordInput,
  ): Promise<ProductEvent> {
    const female = await this.findProductOrThrow(tenantId, payload.femaleProductId);
    const male = await this.findProductOrThrow(tenantId, payload.maleProductId);

    this.assertFemaleProduct(female, 'femaleProductId');
    this.assertMaleProduct(male, 'maleProductId');
    this.assertSameSeries(female, male);

    const eventDate = this.parseEventDate(payload.eventDate);
    const maleCode = this.normalizeRequiredCode(male.code);
    const note = buildTaggedNote(payload.note, {
      maleCode,
    });

    const existing = await this.findDuplicateMatingEvent(tenantId, female.id, eventDate, maleCode);
    if (existing) {
      return this.toProductEvent(existing);
    }

    const event = await this.prisma.productEvent.create({
      data: {
        tenantId,
        productId: female.id,
        eventType: 'mating',
        eventDate,
        note,
      },
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventCreate,
      resourceType: 'product_event',
      resourceId: event.id,
      metadata: {
        eventType: event.eventType,
        femaleProductId: female.id,
        maleProductId: male.id,
      },
    });

    return this.toProductEvent(event);
  }

  async createEggRecord(
    tenantId: string,
    actorUserId: string,
    payload: CreateEggRecordInput,
  ): Promise<ProductEvent> {
    const female = await this.findProductOrThrow(tenantId, payload.femaleProductId);
    this.assertFemaleProduct(female, 'femaleProductId');

    const eventDate = this.parseEventDate(payload.eventDate);
    const eggCount = payload.eggCount ?? null;
    const note = buildTaggedNote(payload.note, {
      eggCount: eggCount ?? undefined,
    });

    const existing = await this.findDuplicateEggEvent(tenantId, female.id, eventDate, eggCount);
    if (existing) {
      return this.toProductEvent(existing);
    }

    const event = await this.prisma.productEvent.create({
      data: {
        tenantId,
        productId: female.id,
        eventType: 'egg',
        eventDate,
        note,
      },
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventCreate,
      resourceType: 'product_event',
      resourceId: event.id,
      metadata: {
        eventType: event.eventType,
        femaleProductId: female.id,
        eggCount,
      },
    });

    return this.toProductEvent(event);
  }

  async createProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: CreateProductEventInput,
  ): Promise<ProductEvent> {
    const product = await this.findProductOrThrow(tenantId, productId);
    this.assertFemaleProduct(product, 'productId');

    const eventDate = this.parseEventDate(payload.eventDate);
    const maleCode =
      payload.eventType === 'mating'
        ? this.normalizeOptionalCode(payload.maleCode) ?? this.normalizeOptionalCode(product.mateCode)
        : this.normalizeOptionalCode(payload.maleCode);

    const oldMateCode = this.normalizeOptionalCode(payload.oldMateCode);
    const newMateCode = this.normalizeOptionalCode(payload.newMateCode);
    const eggCount = payload.eggCount ?? null;

    const note = buildTaggedNote(payload.note, {
      maleCode,
      eggCount: eggCount ?? undefined,
      oldMateCode,
      newMateCode,
    });

    const existing = await this.findDuplicateProductEvent(
      tenantId,
      product.id,
      payload.eventType,
      eventDate,
      {
        maleCode,
        eggCount,
        oldMateCode,
        newMateCode,
      },
    );
    if (existing) {
      return this.toProductEvent(existing);
    }

    const event = await this.prisma.productEvent.create({
      data: {
        tenantId,
        productId: product.id,
        eventType: payload.eventType,
        eventDate,
        note,
      },
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventCreate,
      resourceType: 'product_event',
      resourceId: event.id,
      metadata: {
        eventType: payload.eventType,
        productId,
      },
    });

    return this.toProductEvent(event);
  }

  async listProductEvents(tenantId: string, productId: string): Promise<ProductEvent[]> {
    await this.findProductOrThrow(tenantId, productId);

    const events = await this.prisma.productEvent.findMany({
      where: {
        tenantId,
        productId,
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    return events.map((event) => this.toProductEvent(event));
  }

  private parseEventDate(input: string): Date {
    try {
      return parseEventDateInput(input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid event_date format');
    }
  }

  private utcDayRange(date: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
    return { start, end };
  }

  private async listProductEventsForUtcDay(
    tenantId: string,
    productId: string,
    eventType: string,
    eventDate: Date,
  ): Promise<PrismaProductEvent[]> {
    const { start, end } = this.utcDayRange(eventDate);
    return this.prisma.productEvent.findMany({
      where: {
        tenantId,
        productId,
        eventType,
        eventDate: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private async findDuplicateMatingEvent(
    tenantId: string,
    femaleProductId: string,
    eventDate: Date,
    maleCode: string | null,
  ): Promise<PrismaProductEvent | null> {
    const candidates = await this.listProductEventsForUtcDay(tenantId, femaleProductId, 'mating', eventDate);
    if (candidates.length === 0) {
      return null;
    }

    if (!maleCode) {
      return candidates[0] ?? null;
    }

    for (const event of candidates) {
      const parsed = parseTaggedProductEventNote(event.note);
      if (parsed.maleCode === maleCode) {
        return event;
      }
    }

    return null;
  }

  private async findDuplicateEggEvent(
    tenantId: string,
    femaleProductId: string,
    eventDate: Date,
    eggCount: number | null,
  ): Promise<PrismaProductEvent | null> {
    const candidates = await this.listProductEventsForUtcDay(tenantId, femaleProductId, 'egg', eventDate);
    if (candidates.length === 0) {
      return null;
    }

    if (eggCount === null) {
      return candidates[0] ?? null;
    }

    for (const event of candidates) {
      const parsed = parseTaggedProductEventNote(event.note);
      if (parsed.eggCount === eggCount) {
        return event;
      }
    }

    return null;
  }

  private async findDuplicateProductEvent(
    tenantId: string,
    productId: string,
    eventType: 'mating' | 'egg' | 'change_mate',
    eventDate: Date,
    detail: {
      maleCode: string | null;
      eggCount: number | null;
      oldMateCode: string | null;
      newMateCode: string | null;
    },
  ): Promise<PrismaProductEvent | null> {
    if (eventType === 'mating') {
      return this.findDuplicateMatingEvent(tenantId, productId, eventDate, detail.maleCode);
    }

    if (eventType === 'egg') {
      return this.findDuplicateEggEvent(tenantId, productId, eventDate, detail.eggCount);
    }

    const candidates = await this.listProductEventsForUtcDay(tenantId, productId, 'change_mate', eventDate);
    for (const event of candidates) {
      const parsed = parseTaggedProductEventNote(event.note);
      if (parsed.oldMateCode === detail.oldMateCode && parsed.newMateCode === detail.newMateCode) {
        return event;
      }
    }

    return null;
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

  private assertFemaleProduct(product: PrismaProduct, field: string): void {
    if ((product.sex ?? '').toLowerCase() !== 'female') {
      throw new BadRequestException(`${field} must reference a female breeder.`);
    }
  }

  private assertMaleProduct(product: PrismaProduct, field: string): void {
    if ((product.sex ?? '').toLowerCase() !== 'male') {
      throw new BadRequestException(`${field} must reference a male breeder.`);
    }
  }

  private assertSameSeries(left: PrismaProduct, right: PrismaProduct): void {
    if (!left.seriesId || !right.seriesId || left.seriesId !== right.seriesId) {
      throw new BadRequestException('Mating must be within the same series.');
    }
  }

  private toProductEvent(event: PrismaProductEvent): ProductEvent {
    const parsedNote = parseTaggedProductEventNote(event.note);

    return {
      id: event.id,
      tenantId: event.tenantId,
      productId: event.productId,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString(),
      maleCode: parsedNote.maleCode,
      eggCount: parsedNote.eggCount,
      oldMateCode: parsedNote.oldMateCode,
      newMateCode: parsedNote.newMateCode,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  async updateProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    eventId: string,
    payload: UpdateProductEventInput,
  ): Promise<ProductEvent> {
    const product = await this.findProductOrThrow(tenantId, productId);

    const existing = await this.prisma.productEvent.findFirst({
      where: {
        id: eventId,
        tenantId,
        productId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        message: '未找到种龟事件。',
        errorCode: ErrorCode.ProductEventNotFound,
      });
    }

    const mutableFields = (
      PRODUCT_EVENT_MUTABLE_FIELDS[existing.eventType as ProductEventType] ?? []
    ) as readonly string[];
    const input = payload as Record<string, unknown>;
    const existingTagged = parseTaggedProductEventNote(existing.note);
    const nextEventDate =
      mutableFields.includes('eventDate') && typeof input.eventDate === 'string'
        ? this.parseEventDate(input.eventDate)
        : existing.eventDate;
    const hasNotePatch = Object.prototype.hasOwnProperty.call(input, 'note');
    const nextBaseNote = hasNotePatch
      ? this.normalizeOptionalText(payload.note)
      : this.normalizeOptionalText(existingTagged.note);
    const nextMaleCode =
      mutableFields.includes('maleCode') && (input.maleCode === null || typeof input.maleCode === 'string')
        ? this.normalizeOptionalCode(input.maleCode as string | null)
        : this.normalizeOptionalCode(existingTagged.maleCode);
    const nextEggCount =
      mutableFields.includes('eggCount') && (input.eggCount === null || typeof input.eggCount === 'number')
        ? typeof input.eggCount === 'number'
          ? input.eggCount
          : null
        : typeof existingTagged.eggCount === 'number'
          ? existingTagged.eggCount
          : null;
    const nextOldMateCode =
      mutableFields.includes('oldMateCode') && (input.oldMateCode === null || typeof input.oldMateCode === 'string')
        ? this.normalizeOptionalCode(input.oldMateCode as string | null)
        : this.normalizeOptionalCode(existingTagged.oldMateCode);
    const nextNewMateCode =
      mutableFields.includes('newMateCode') && (input.newMateCode === null || typeof input.newMateCode === 'string')
        ? this.normalizeOptionalCode(input.newMateCode as string | null)
        : this.normalizeOptionalCode(existingTagged.newMateCode);

    if (existing.eventType === 'change_mate' && !nextOldMateCode && !nextNewMateCode) {
      throw new BadRequestException({
        message: '换公事件至少填写旧配偶或新配偶其中一个。',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const nextNote = buildTaggedNote(nextBaseNote, {
      maleCode: nextMaleCode,
      eggCount: typeof nextEggCount === 'number' ? nextEggCount : undefined,
      oldMateCode: nextOldMateCode,
      newMateCode: nextNewMateCode,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.productEvent.update({
        where: {
          id_tenantId: {
            id: existing.id,
            tenantId,
          },
        },
        data: {
          eventDate: nextEventDate,
          note: nextNote,
        },
      });

      if (existing.eventType === 'egg') {
        const syncedBatches = await this.syncEggEventSnapshotsAfterChange(tx, tenantId, product, row);
        await this.syncCertificatesForBatches(tx, tenantId, syncedBatches);
      } else if (existing.eventType === 'mating' || existing.eventType === 'change_mate') {
        const syncedBatches = await this.syncAllSaleBatchSireSnapshots(tx, tenantId, product);
        await this.syncCertificatesForBatches(tx, tenantId, syncedBatches);
      }

      return row;
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventUpdate,
      resourceType: 'product_event',
      resourceId: updated.id,
      metadata: {
        before: this.toProductEvent(existing),
        after: this.toProductEvent(updated),
      },
    });

    return this.toProductEvent(updated);
  }

  async deleteProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    eventId: string,
  ): Promise<{ deleted: boolean; eventId: string }> {
    const product = await this.findProductOrThrow(tenantId, productId);

    const existing = await this.prisma.productEvent.findFirst({
      where: {
        id: eventId,
        tenantId,
        productId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        message: '未找到种龟事件。',
        errorCode: ErrorCode.ProductEventNotFound,
      });
    }

    const impact = await this.prisma.$transaction(async (tx) => {
      let unlinkedCertificateCount = 0;
      let removedBatchCount = 0;

      if (existing.eventType === 'egg') {
        const deletionImpact = await this.unlinkCertificatesForDeletedEggEvent(tx, tenantId, existing.id);
        unlinkedCertificateCount = deletionImpact.unlinkedCertificateCount;
        removedBatchCount = deletionImpact.removedBatchCount;
      }

      await tx.productEvent.delete({
        where: {
          id_tenantId: {
            id: existing.id,
            tenantId,
          },
        },
      });

      if (existing.eventType === 'mating' || existing.eventType === 'change_mate') {
        const syncedBatches = await this.syncAllSaleBatchSireSnapshots(tx, tenantId, product);
        await this.syncCertificatesForBatches(tx, tenantId, syncedBatches);
      }

      return {
        unlinkedCertificateCount,
        removedBatchCount,
      };
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventDelete,
      resourceType: 'product_event',
      resourceId: existing.id,
      metadata: {
        before: this.toProductEvent(existing),
        impact,
      },
    });

    return {
      deleted: true,
      eventId: existing.id,
    };
  }

  private async syncEggEventSnapshotsAfterChange(
    tx: Prisma.TransactionClient,
    tenantId: string,
    product: PrismaProduct,
    event: PrismaProductEvent,
  ): Promise<PrismaSaleBatch[]> {
    const rows = await tx.saleBatch.findMany({
      where: {
        tenantId,
        femaleProductId: product.id,
        eggEventId: event.id,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (rows.length === 0) {
      return [];
    }

    const parsed = parseTaggedProductEventNote(event.note);
    const eggCount = typeof parsed.eggCount === 'number' ? parsed.eggCount : null;
    const synced: PrismaSaleBatch[] = [];

    for (const row of rows) {
      const nextSireCode = await this.resolveSireCodeForEggEventDate(
        tx,
        tenantId,
        product,
        event.eventDate,
        row.sireCodeSnapshot,
      );
      const updated = await tx.saleBatch.update({
        where: {
          id_tenantId: {
            id: row.id,
            tenantId,
          },
        },
        data: {
          eventDateSnapshot: event.eventDate,
          eggCountSnapshot: eggCount,
          sireCodeSnapshot: nextSireCode,
        },
      });
      synced.push(updated);
    }

    return synced;
  }

  private async syncAllSaleBatchSireSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    product: PrismaProduct,
  ): Promise<PrismaSaleBatch[]> {
    const rows = await tx.saleBatch.findMany({
      where: {
        tenantId,
        femaleProductId: product.id,
      },
      include: {
        eggEvent: {
          select: {
            eventDate: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (rows.length === 0) {
      return [];
    }

    const changed: PrismaSaleBatch[] = [];
    for (const row of rows) {
      const eventDate = row.eggEvent?.eventDate ?? row.eventDateSnapshot;
      const nextSireCode = await this.resolveSireCodeForEggEventDate(
        tx,
        tenantId,
        product,
        eventDate,
        row.sireCodeSnapshot,
      );
      if (nextSireCode === row.sireCodeSnapshot) {
        continue;
      }

      const updated = await tx.saleBatch.update({
        where: {
          id_tenantId: {
            id: row.id,
            tenantId,
          },
        },
        data: {
          sireCodeSnapshot: nextSireCode,
        },
      });
      changed.push(updated);
    }

    return changed;
  }

  private async syncCertificatesForBatches(
    tx: Prisma.TransactionClient,
    tenantId: string,
    batches: PrismaSaleBatch[],
  ): Promise<void> {
    if (batches.length === 0) {
      return;
    }

    const batchById = new Map(batches.map((item) => [item.id, item] as const));
    const rows = await tx.productCertificate.findMany({
      where: {
        tenantId,
        saleBatchId: {
          in: batches.map((item) => item.id),
        },
      },
      select: {
        id: true,
        saleBatchId: true,
        lineageSnapshot: true,
        saleSnapshot: true,
      },
    });

    for (const row of rows) {
      const batchId = row.saleBatchId?.trim();
      if (!batchId) {
        continue;
      }
      const batch = batchById.get(batchId);
      if (!batch) {
        continue;
      }

      await tx.productCertificate.update({
        where: {
          id: row.id,
        },
        data: {
          saleSnapshot: this.patchCertificateSaleSnapshot(row.saleSnapshot, batch),
          lineageSnapshot: this.patchCertificateLineageSnapshot(row.lineageSnapshot, batch),
        },
      });
    }
  }

  private patchCertificateSaleSnapshot(
    snapshot: Prisma.JsonValue | null,
    batch: PrismaSaleBatch,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return snapshot === null ? Prisma.DbNull : (snapshot as Prisma.InputJsonValue);
    }

    const root = snapshot as Prisma.JsonObject;
    const batchNode = root.batch;
    if (!batchNode || typeof batchNode !== 'object' || Array.isArray(batchNode)) {
      return root as Prisma.InputJsonValue;
    }

    return {
      ...root,
      batch: {
        ...(batchNode as Prisma.JsonObject),
        id: batch.id,
        batchNo: batch.batchNo,
        status: batch.status,
        plannedQuantity: batch.plannedQuantity,
        soldQuantity: batch.soldQuantity,
        eventDateSnapshot: batch.eventDateSnapshot.toISOString(),
        eggCountSnapshot: batch.eggCountSnapshot,
        priceLow: batch.priceLow?.toNumber() ?? null,
        priceHigh: batch.priceHigh?.toNumber() ?? null,
      },
    } as Prisma.InputJsonValue;
  }

  private patchCertificateLineageSnapshot(
    snapshot: Prisma.JsonValue,
    batch: PrismaSaleBatch,
  ): Prisma.InputJsonValue {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return snapshot as Prisma.InputJsonValue;
    }

    const root = snapshot as Prisma.JsonObject;
    const next: Prisma.JsonObject = { ...root };

    const batchNode = root.batch;
    if (batchNode && typeof batchNode === 'object' && !Array.isArray(batchNode)) {
      next.batch = {
        ...(batchNode as Prisma.JsonObject),
        id: batch.id,
        batchNo: batch.batchNo,
        eggEventId: batch.eggEventId,
        eventDateSnapshot: batch.eventDateSnapshot.toISOString(),
        eggCountSnapshot: batch.eggCountSnapshot,
        plannedQuantity: batch.plannedQuantity,
        soldQuantity: batch.soldQuantity,
      };
    }

    const maleNode = root.male;
    if (maleNode && typeof maleNode === 'object' && !Array.isArray(maleNode)) {
      next.male = {
        ...(maleNode as Prisma.JsonObject),
        code: batch.sireCodeSnapshot,
      };
    }

    return next as Prisma.InputJsonValue;
  }

  private async unlinkCertificatesForDeletedEggEvent(
    tx: Prisma.TransactionClient,
    tenantId: string,
    eggEventId: string,
  ): Promise<{ unlinkedCertificateCount: number; removedBatchCount: number }> {
    const saleBatches = await tx.saleBatch.findMany({
      where: {
        tenantId,
        eggEventId,
      },
      select: {
        id: true,
      },
    });
    const batchIds = saleBatches.map((item) => item.id);

    const certificates = await tx.productCertificate.findMany({
      where: {
        tenantId,
        OR: [
          {
            eggEventId,
          },
          ...(batchIds.length > 0
            ? [
                {
                  saleBatchId: {
                    in: batchIds,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        lineageSnapshot: true,
      },
    });

    for (const certificate of certificates) {
      await tx.productCertificate.update({
        where: {
          id: certificate.id,
        },
        data: {
          eggEventId: null,
          saleBatchId: null,
          saleAllocationId: null,
          subjectMediaId: null,
          saleSnapshot: Prisma.DbNull,
          lineageSnapshot: this.clearCertificateLineageBatchSnapshot(certificate.lineageSnapshot),
        },
      });
    }

    if (batchIds.length > 0) {
      await tx.saleBatch.deleteMany({
        where: {
          tenantId,
          id: {
            in: batchIds,
          },
        },
      });
    }

    return {
      unlinkedCertificateCount: certificates.length,
      removedBatchCount: batchIds.length,
    };
  }

  private clearCertificateLineageBatchSnapshot(snapshot: Prisma.JsonValue): Prisma.InputJsonValue {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return snapshot as Prisma.InputJsonValue;
    }

    const root = snapshot as Prisma.JsonObject;
    if (!Object.prototype.hasOwnProperty.call(root, 'batch')) {
      return root as Prisma.InputJsonValue;
    }

    return {
      ...root,
      batch: null,
    } as Prisma.InputJsonValue;
  }

  private async resolveSireCodeForEggEventDate(
    tx: Prisma.TransactionClient,
    tenantId: string,
    product: PrismaProduct,
    eventDate: Date,
    fallback: string,
  ): Promise<string> {
    const latestMating = await tx.productEvent.findFirst({
      where: {
        tenantId,
        productId: product.id,
        eventType: 'mating',
        eventDate: {
          lte: eventDate,
        },
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    const parsedMating = parseTaggedProductEventNote(latestMating?.note ?? null);
    const candidate =
      this.normalizeOptionalCode(parsedMating.maleCode) ??
      this.normalizeOptionalCode(product.mateCode) ??
      this.normalizeOptionalCode(fallback);

    if (!candidate) {
      throw new BadRequestException({
        message: '无法根据事件记录锁定父本编码。',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    return candidate;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
