import {
  updateProductEventRequestSchema,
  type CreateProductEventRequest,
  type ProductEvent,
  type UpdateProductEventRequest,
} from '@eggturtle/shared';

import { normalizeOptionalCode } from '@/components/product-drawer/shared';

export type ProductEventEntryType = 'mating' | 'egg' | 'change_mate';
export type EventTypeQuickFilter = 'all' | ProductEventEntryType;

export type ProductEventFormState = {
  eventType: 'none' | ProductEventEntryType;
  eventDate: string;
  maleCode: string;
  eggCount: string;
  oldMateCode: string;
  newMateCode: string;
  note: string;
};

export type ProductEventEditFormState = {
  eventDate: string;
  maleCode: string;
  eggCount: string;
  oldMateCode: string;
  newMateCode: string;
  note: string;
};

export const PRODUCT_EVENT_ENTRY_OPTIONS: Array<{
  key: ProductEventEntryType;
  label: string;
  hint: string;
}> = [
  { key: 'mating', label: '交配', hint: '记录这次与哪只公龟配对。' },
  { key: 'egg', label: '产蛋', hint: '记录这次产蛋日期与数量。' },
  { key: 'change_mate', label: '换公', hint: '记录旧配偶与新配偶交接。' },
];

export function toDefaultEventFormState(): ProductEventFormState {
  return {
    eventType: 'none',
    eventDate: toLocalDateInputValue(new Date()),
    maleCode: '',
    eggCount: '',
    oldMateCode: '',
    newMateCode: '',
    note: '',
  };
}

export function isEditableEventType(
  eventType: string,
): eventType is 'mating' | 'egg' | 'change_mate' {
  return eventType === 'mating' || eventType === 'egg' || eventType === 'change_mate';
}

export function toProductEventEditFormState(event: ProductEvent): ProductEventEditFormState {
  return {
    eventDate: toDateInputValue(event.eventDate),
    maleCode: event.maleCode ?? '',
    eggCount: event.eggCount === null || event.eggCount === undefined ? '' : String(event.eggCount),
    oldMateCode: event.oldMateCode ?? '',
    newMateCode: event.newMateCode ?? '',
    note: extractDisplayNote(event.note),
  };
}

export function buildUpdateEventPayload(
  eventType: string,
  form: ProductEventEditFormState,
): UpdateProductEventRequest {
  if (!isEditableEventType(eventType)) {
    throw new Error('当前事件类型暂不支持编辑。');
  }

  const eventDate = form.eventDate.trim();
  if (!eventDate) {
    throw new Error('请选择事件日期。');
  }

  const note = form.note.trim() ? form.note.trim() : null;
  const maleCode = normalizeOptionalCode(form.maleCode);
  const oldMateCode = normalizeOptionalCode(form.oldMateCode);
  const newMateCode = normalizeOptionalCode(form.newMateCode);

  let eggCount: number | null | undefined = undefined;
  if (eventType === 'egg') {
    if (!form.eggCount.trim()) {
      eggCount = null;
    } else {
      const rawEggCount = Number(form.eggCount.trim());
      if (!Number.isInteger(rawEggCount) || rawEggCount < 0 || rawEggCount > 999) {
        throw new Error('产蛋数量需要是 0-999 的整数。');
      }
      eggCount = rawEggCount;
    }
  }

  if (eventType === 'change_mate' && !oldMateCode && !newMateCode) {
    throw new Error('换公事件至少填写旧配偶或新配偶其中一个。');
  }

  return updateProductEventRequestSchema.parse({
    eventDate,
    note,
    maleCode: eventType === 'mating' ? maleCode : undefined,
    eggCount: eventType === 'egg' ? eggCount : undefined,
    oldMateCode: eventType === 'change_mate' ? oldMateCode : undefined,
    newMateCode: eventType === 'change_mate' ? newMateCode : undefined,
  });
}

export function sortProductEvents(items: ProductEvent[]): ProductEvent[] {
  return [...items].sort((left, right) => {
    const eventDateDiff = new Date(right.eventDate).getTime() - new Date(left.eventDate).getTime();
    if (eventDateDiff !== 0) {
      return eventDateDiff;
    }

    const createdAtDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return right.id.localeCompare(left.id, 'zh-CN');
  });
}

export function toDemoUpdatedProductEvent(
  event: ProductEvent,
  payload: UpdateProductEventRequest,
): ProductEvent {
  return {
    ...event,
    eventDate: payload.eventDate ? toEventDateIso(payload.eventDate) : event.eventDate,
    maleCode: payload.maleCode !== undefined ? normalizeOptionalCode(payload.maleCode) : event.maleCode,
    eggCount: payload.eggCount !== undefined ? payload.eggCount : event.eggCount,
    oldMateCode:
      payload.oldMateCode !== undefined ? normalizeOptionalCode(payload.oldMateCode) : event.oldMateCode,
    newMateCode:
      payload.newMateCode !== undefined ? normalizeOptionalCode(payload.newMateCode) : event.newMateCode,
    note: payload.note !== undefined ? payload.note : event.note,
    updatedAt: new Date().toISOString(),
  };
}

export function toDemoProductEvent(
  productId: string,
  tenantId: string,
  payload: CreateProductEventRequest,
): ProductEvent {
  const now = new Date().toISOString();

  return {
    id: `demo-event-${Date.now()}`,
    tenantId,
    productId,
    eventType: payload.eventType,
    eventDate: toEventDateIso(payload.eventDate),
    maleCode: normalizeOptionalCode(payload.maleCode),
    eggCount: payload.eggCount ?? null,
    oldMateCode: normalizeOptionalCode(payload.oldMateCode),
    newMateCode: normalizeOptionalCode(payload.newMateCode),
    note: payload.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function extractDisplayNote(note: string | null): string {
  if (!note) {
    return '';
  }

  return note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !(line.startsWith('#') && line.includes('=')))
    .join('\n');
}

export function formatEventTypeLabel(eventType: string): string {
  if (eventType === 'mating') {
    return '交配';
  }
  if (eventType === 'egg') {
    return '产蛋';
  }
  if (eventType === 'change_mate') {
    return '换公';
  }

  return eventType || '未知';
}

export function formatEventDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatEventSummary(event: ProductEvent): string {
  if (event.eventType === 'mating') {
    return `公龟编码：${event.maleCode || '未填写'}`;
  }
  if (event.eventType === 'egg') {
    return `产蛋数量：${event.eggCount ?? '未填写'}`;
  }
  if (event.eventType === 'change_mate') {
    return `旧配偶：${event.oldMateCode || '未填写'}；新配偶：${event.newMateCode || '未填写'}`;
  }

  return '未定义事件详情';
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateInputValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return toLocalDateInputValue(new Date());
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toEventDateIso(value: string) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00.000Z`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}
