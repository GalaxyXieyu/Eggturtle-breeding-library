type FormatSexOptions = {
  emptyLabel?: string;
  unknownLabel?: string;
};

export function formatSex(value?: string | null, options: FormatSexOptions = {}) {
  const emptyLabel = options.emptyLabel ?? '未知';
  const unknownLabel = options.unknownLabel ?? emptyLabel;
  const normalized = (value ?? '').trim();

  if (!normalized) {
    return emptyLabel;
  }

  if (normalized === 'male') {
    return '公';
  }

  if (normalized === 'female') {
    return '母';
  }

  if (normalized === 'unknown') {
    return unknownLabel;
  }

  return normalized;
}

export function formatPrice(value: number) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function formatShortDate(value?: string | null) {
  const raw = (value ?? '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return '';
  }

  return `${match[2]}.${match[3]}`;
}
