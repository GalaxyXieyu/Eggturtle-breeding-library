import { type ProductEvent } from '@eggturtle/shared';
import { ApiError, resolveAuthenticatedAssetUrl } from '@/lib/api-client';

export type EventCollisionMeta = {
  duplicateCount: number;
  duplicateIndex: number;
};

export function buildLocalDateTimeValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseOptionalDecimalInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`金额格式无效：${value}`);
  }

  return parsed;
}

export function resolveImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
}

export function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}

export function eventTypeLabel(eventType: string) {
  if (eventType === 'mating') return '交配';
  if (eventType === 'egg') return '产蛋';
  if (eventType === 'change_mate') return '换公';
  return eventType;
}

export function eventTypeIcon(eventType: string) {
  if (eventType === 'mating') return '🔞';
  if (eventType === 'egg') return '🥚';
  if (eventType === 'change_mate') return '🔁';
  return '•';
}

export function formatEventShortDate(isoDate: string) {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}.${day}`;
}

export function formatEventClock(isoDate: string) {
  const d = new Date(isoDate);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatEventYear(isoDate: string) {
  const d = new Date(isoDate);
  return String(d.getFullYear());
}

export function formatDateShort(isoDate: string) {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildEventCollisionMeta(events: ProductEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = `${event.eventType}|${event.eventDate}|${buildEventSummary(event)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const meta = new Map<string, EventCollisionMeta>();
  for (const event of events) {
    const key = `${event.eventType}|${event.eventDate}|${buildEventSummary(event)}`;
    const duplicateIndex = (seen.get(key) ?? 0) + 1;
    seen.set(key, duplicateIndex);
    meta.set(event.id, {
      duplicateCount: counts.get(key) ?? 1,
      duplicateIndex,
    });
  }

  return meta;
}

export function buildEggEventOptionLabel(event: ProductEvent, collision?: EventCollisionMeta) {
  const baseLabel = `${formatEventShortDate(event.eventDate)} · ${buildEventSummary(event)}`;
  if (!collision || collision.duplicateCount <= 1) {
    return baseLabel;
  }

  return `${baseLabel} · ${formatEventClock(event.createdAt)}`;
}

export function buildEventDetailLabel(event: ProductEvent, collision?: EventCollisionMeta) {
  const baseLabel = buildEventSummary(event);
  if (!collision || collision.duplicateCount <= 1) {
    return baseLabel;
  }

  return `${baseLabel} · 录入 ${formatEventClock(event.createdAt)}`;
}

const EVENT_NOTE_SKIP_KEYS = new Set([
  'backfill',
  'flags',
  'malecode',
  'eggcount',
  'oldmatecode',
  'newmatecode',
]);

const EVENT_NOTE_PROMOTE_KEYS = new Set([
  'raw',
  'note',
  'remark',
  'comment',
  'memo',
  'description',
]);

function normalizeEventNoteSegment(value: string) {
  const normalized = value.trim().replace(/^['"`]+|['"`]+$/g, '');
  return normalized || null;
}

function appendReadableEventNoteValue(value: string, segments: string[]) {
  const normalizedValue = normalizeEventNoteSegment(value);
  if (!normalizedValue) {
    return;
  }

  const jsonExtracted = extractReadableEventNoteFromJson(normalizedValue);
  if (jsonExtracted) {
    for (const line of jsonExtracted.split(/\r?\n/)) {
      const normalizedLine = normalizeEventNoteSegment(line);
      if (normalizedLine) {
        segments.push(normalizedLine);
      }
    }
    return;
  }

  if (/[;\n]/.test(normalizedValue)) {
    for (const line of normalizedValue.split(/\r?\n/)) {
      collectReadableEventNoteSegments(line, segments);
    }
    return;
  }

  segments.push(normalizedValue);
}

function collectReadableEventNoteSegments(source: string, segments: string[]) {
  for (const part of source.split(/\s*;\s*/)) {
    const normalizedPart = normalizeEventNoteSegment(part);
    if (!normalizedPart) {
      continue;
    }

    const taggedMatch = normalizedPart.match(/^(?:#)?([A-Za-z][\w-]*)\s*[:=]\s*(.+)$/);
    if (!taggedMatch) {
      appendReadableEventNoteValue(normalizedPart, segments);
      continue;
    }

    const key = taggedMatch[1].trim().toLowerCase();
    const value = normalizeEventNoteSegment(taggedMatch[2]);
    if (!value || EVENT_NOTE_SKIP_KEYS.has(key)) {
      continue;
    }

    if (EVENT_NOTE_PROMOTE_KEYS.has(key)) {
      appendReadableEventNoteValue(value, segments);
    }
  }
}

function extractReadableEventNoteFromJson(note: string) {
  if (!note.startsWith('{') || !note.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(note) as Record<string, unknown>;
    const readableSegments: string[] = [];

    for (const [rawKey, rawValue] of Object.entries(parsed)) {
      const key = rawKey.trim().toLowerCase();
      if (EVENT_NOTE_SKIP_KEYS.has(key)) {
        continue;
      }

      if (typeof rawValue !== 'string') {
        continue;
      }

      const value = normalizeEventNoteSegment(rawValue);
      if (!value) {
        continue;
      }

      if (EVENT_NOTE_PROMOTE_KEYS.has(key)) {
        appendReadableEventNoteValue(value, readableSegments);
      }
    }

    return readableSegments.length > 0 ? readableSegments.join('\n') : null;
  } catch {
    return null;
  }
}

export function sanitizeEventNoteForDisplay(note: string | null | undefined) {
  const trimmedNote = note?.trim();
  if (!trimmedNote) {
    return null;
  }

  const jsonExtracted = extractReadableEventNoteFromJson(trimmedNote);
  if (jsonExtracted) {
    return jsonExtracted;
  }

  const readableSegments: string[] = [];
  for (const line of trimmedNote.split(/\r?\n/)) {
    collectReadableEventNoteSegments(line, readableSegments);
  }

  const dedupedSegments = readableSegments.filter(
    (segment, index) => readableSegments.indexOf(segment) === index,
  );

  return dedupedSegments.length > 0 ? dedupedSegments.join('\n') : null;
}

export function buildEventSummary(event: ProductEvent) {
  if (event.eventType === 'mating') {
    return `公龟 ${event.maleCode || '-'}`;
  }
  if (event.eventType === 'egg') {
    return `数量 ${typeof event.eggCount === 'number' ? event.eggCount : '-'}`;
  }
  if (event.eventType === 'change_mate') {
    return `换公 ${(event.oldMateCode || '-') + ' → ' + (event.newMateCode || '-')}`;
  }
  return '-';
}
