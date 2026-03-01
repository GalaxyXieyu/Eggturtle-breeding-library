import type { Breeder } from '@/types/turtleAlbum';

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

// Prefer explicitly-provided mainImageUrl (some API responses include it),
// then a typed "main" image, then the first available image.
export const getBreederImagePath = (breeder: Partial<Breeder> | null | undefined): string => {
  if (!breeder) return '';

  const maybeMainImageUrl = (breeder as { mainImageUrl?: unknown }).mainImageUrl;
  if (nonEmptyString(maybeMainImageUrl)) return maybeMainImageUrl.trim();

  const images = breeder.images || [];
  const main = images.find((img) => img?.type === 'main' && nonEmptyString(img.url));
  if (main) return main.url.trim();

  const first = images.find((img) => nonEmptyString(img.url));
  if (first) return first.url.trim();

  return '';
};
