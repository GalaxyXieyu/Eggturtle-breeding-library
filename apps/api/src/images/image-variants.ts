import sharp from 'sharp';

export type AllowedMaxEdge = 480 | 960;

export function resolveAllowedMaxEdge(raw: unknown): AllowedMaxEdge | undefined {
  // Keep a strict allowlist to avoid arbitrary resize abuse.
  if (raw === 480 || raw === 960) {
    return raw;
  }
  return undefined;
}

export async function resizeToWebpMaxEdge(input: {
  body: Buffer;
  maxEdge: AllowedMaxEdge;
}): Promise<{ body: Buffer; contentType: string }> {
  // Use a deterministic output format for thumbnails.
  const pipeline = sharp(input.body, { failOn: 'none' })
    .rotate()
    .resize({
      width: input.maxEdge,
      height: input.maxEdge,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 82, effort: 4 });

  return { body: await pipeline.toBuffer(), contentType: 'image/webp' };
}
