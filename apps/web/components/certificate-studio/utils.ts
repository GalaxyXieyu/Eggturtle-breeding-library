export function formatDateShort(isoDate: string) {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}.${day}`;
}

export function resolveImageUrl(value: string) {
  // This will be imported from api-client
  return value;
}
