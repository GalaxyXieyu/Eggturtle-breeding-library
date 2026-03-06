import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  ProductEvent,
} from '@eggturtle/shared';
import type {
  Product as PrismaProduct,
  ProductEvent as PrismaProductEvent,
} from '@prisma/client';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';

import {
  buildTaggedNote,
  normalizeCodeUpper,
  parseEventDateInput,
} from './breeding-rules';
import { parseTaggedProductEventNote } from './product-event-utils';
import type {
  CreateEggRecordInput,
  CreateMatingRecordInput,
  CreateProductEventInput,
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
}
