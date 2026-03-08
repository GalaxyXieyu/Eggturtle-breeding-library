import sharp from 'sharp';

export type AllowedMaxEdge = 320 | 480 | 960;

export function resolveAllowedMaxEdge(raw: unknown): AllowedMaxEdge | undefined {
  // Keep a strict allowlist to avoid arbitrary resize abuse.
  if (raw === 320 || raw === 480 || raw === 960) {
    return raw;
  }
  return undefined;
}

export function buildWebpVariantKey(originalKey: string, maxEdge: AllowedMaxEdge): string {
  const normalized = originalKey.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  const extensionIndex = normalized.lastIndexOf('.');
  const slashIndex = normalized.lastIndexOf('/');

  if (extensionIndex <= slashIndex) {
    return `${normalized}.mx${maxEdge}.webp`;
  }

  return `${normalized.slice(0, extensionIndex)}.mx${maxEdge}.webp`;
}

export async function resizeToWebpMaxEdge(input: {
  body: Buffer;
  maxEdge: AllowedMaxEdge;
}): Promise<{ body: Buffer; contentType: string }> {
  const quality = input.maxEdge <= 320 ? 70 : input.maxEdge <= 480 ? 74 : 80;

  // Use a deterministic output format for thumbnails.
  const pipeline = sharp(input.body, { failOn: 'none' })
    .rotate()
    .resize({
      width: input.maxEdge,
      height: input.maxEdge,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality, effort: 4 });

  return { body: await pipeline.toBuffer(), contentType: 'image/webp' };
}
