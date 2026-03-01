export function parseIsoDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Display rule: users prefer mm.dd short form.
export function formatMmDd(value: string | null | undefined): string {
  const d = parseIsoDate(value);
  if (!d) return '-';
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

export function formatYear(value: string | null | undefined): string {
  const d = parseIsoDate(value);
  if (!d) return '';
  return String(d.getFullYear());
}
