import { createSeriesRequestSchema, createSeriesResponseSchema } from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

export type ProductSeriesOption = {
  id: string;
  code: string;
  name: string;
};

export type ProductBooleanField =
  | 'excludeFromBreeding'
  | 'hasSample'
  | 'inStock'
  | 'isFeatured';

export type ProductSex = '' | 'male' | 'female';

export type SeriesResolveResult =
  | {
      type: 'matchedExisting';
      seriesId: string | null;
      matched: ProductSeriesOption | null;
      input: string;
    }
  | {
      type: 'requireNewSeries';
      input: string;
    };

export const PRODUCT_BOOLEAN_TOGGLES: Array<{
  field: ProductBooleanField;
  label: string;
  activeClassName: string;
}> = [
  {
    field: 'excludeFromBreeding',
    label: '不参与繁殖',
    activeClassName:
      'border-amber-300 bg-amber-50 text-amber-700 shadow-[0_6px_16px_rgba(251,191,36,0.22)]'
  },
  {
    field: 'hasSample',
    label: '有样本',
    activeClassName:
      'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_6px_16px_rgba(16,185,129,0.2)]'
  },
  {
    field: 'inStock',
    label: '在库',
    activeClassName:
      'border-sky-300 bg-sky-50 text-sky-700 shadow-[0_6px_16px_rgba(14,165,233,0.2)]'
  },
  {
    field: 'isFeatured',
    label: '精选',
    activeClassName:
      'border-violet-300 bg-violet-50 text-violet-700 shadow-[0_6px_16px_rgba(139,92,246,0.2)]'
  }
];

export function parsePopularityScore(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return null;
  }

  return value;
}

export function parseOffspringUnitPrice(sex: ProductSex, input: string): number | null | 'invalid' {
  if (sex !== 'female') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return 'invalid';
  }

  return value;
}

export function parseSeriesSortOrder(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    throw new Error('系列排序必须是整数。');
  }

  return value;
}

export function toSuggestedSeriesCode(input: string) {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-_]/g, '-');
  const compact = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');

  return compact || 'NEW-SERIES';
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function resolveSeriesInput(
  input: string,
  seriesOptions: ProductSeriesOption[]
): SeriesResolveResult {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return {
      type: 'matchedExisting',
      input: '',
      seriesId: null,
      matched: null
    };
  }

  const normalizedInput = normalizeText(trimmedInput);

  const codeMatched = seriesOptions.find((item) => normalizeText(item.code) === normalizedInput);
  if (codeMatched) {
    return {
      type: 'matchedExisting',
      input: trimmedInput,
      seriesId: codeMatched.id,
      matched: codeMatched
    };
  }

  const nameMatched = seriesOptions.find((item) => normalizeText(item.name) === normalizedInput);
  if (nameMatched) {
    return {
      type: 'matchedExisting',
      input: trimmedInput,
      seriesId: nameMatched.id,
      matched: nameMatched
    };
  }

  const idMatched = seriesOptions.find((item) => normalizeText(item.id) === normalizedInput);
  if (idMatched) {
    return {
      type: 'matchedExisting',
      input: trimmedInput,
      seriesId: idMatched.id,
      matched: idMatched
    };
  }

  return {
    type: 'requireNewSeries',
    input: trimmedInput
  };
}

export async function createSeriesIfNeeded(input: {
  isDemoMode: boolean;
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}): Promise<ProductSeriesOption> {
  const nextSeriesCode = input.code.trim().toUpperCase();
  const nextSeriesName = input.name.trim();

  if (!nextSeriesCode || !nextSeriesName) {
    throw new Error('新系列需要填写系列编码和系列名称。');
  }

  const parsedSortOrder = parseSeriesSortOrder(input.sortOrder);

  if (input.isDemoMode) {
    return {
      id: `demo-series-${Date.now()}`,
      code: nextSeriesCode,
      name: nextSeriesName
    };
  }

  const payload = createSeriesRequestSchema.parse({
    code: nextSeriesCode,
    name: nextSeriesName,
    description: input.description.trim() ? input.description.trim() : null,
    sortOrder: parsedSortOrder,
    isActive: input.isActive
  });

  const response = await apiRequest('/series', {
    method: 'POST',
    body: payload,
    requestSchema: createSeriesRequestSchema,
    responseSchema: createSeriesResponseSchema
  });

  return {
    id: response.series.id,
    code: response.series.code,
    name: response.series.name
  };
}
