export type ParsedTaggedProductEventNote = {
  note: string | null;
  maleCode: string | null;
  eggCount: number | null;
  oldMateCode: string | null;
  newMateCode: string | null;
};

export type NeedMatingStatus = 'normal' | 'need_mating' | 'warning';

export function normalizeTaggedCode(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

export function parseTaggedProductEventNote(note: string | null): ParsedTaggedProductEventNote {
  if (!note) {
    return {
      note: null,
      maleCode: null,
      eggCount: null,
      oldMateCode: null,
      newMateCode: null
    };
  }

  let maleCode: string | null = null;
  let eggCount: number | null = null;
  let oldMateCode: string | null = null;
  let newMateCode: string | null = null;
  const noteLines: string[] = [];

  for (const rawLine of note.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (!line.startsWith('#') || !line.includes('=')) {
      noteLines.push(line);
      continue;
    }

    const [rawKey, ...rest] = line.slice(1).split('=');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join('=').trim();

    if (!value) {
      continue;
    }

    if (key === 'malecode') {
      maleCode = normalizeTaggedCode(value);
      continue;
    }

    if (key === 'eggcount') {
      const parsed = Number(value);
      eggCount = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
      continue;
    }

    if (key === 'oldmatecode') {
      oldMateCode = normalizeTaggedCode(value);
      continue;
    }

    if (key === 'newmatecode') {
      newMateCode = normalizeTaggedCode(value);
      continue;
    }
  }

  return {
    note: noteLines.length > 0 ? noteLines.join('\n') : null,
    maleCode,
    eggCount,
    oldMateCode,
    newMateCode
  };
}

export function calculateDaysSince(value: Date | null, nowMs = Date.now()): number | null {
  if (!value) {
    return null;
  }

  const diffMs = nowMs - value.getTime();
  if (diffMs < 0) {
    return 0;
  }

  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function resolveNeedMatingStatus(
  lastEggAt: Date | null,
  lastMatingAt: Date | null,
  excludeFromBreeding: boolean,
  nowMs = Date.now()
): NeedMatingStatus {
  if (excludeFromBreeding) {
    return 'normal';
  }

  if (!lastEggAt) {
    return 'normal';
  }

  if (lastMatingAt && lastMatingAt.getTime() >= lastEggAt.getTime()) {
    return 'normal';
  }

  const daysSinceEgg = calculateDaysSince(lastEggAt, nowMs);
  if (daysSinceEgg !== null && daysSinceEgg >= 25) {
    return 'warning';
  }

  return 'need_mating';
}
