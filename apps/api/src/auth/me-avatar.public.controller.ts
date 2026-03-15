import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Query,
  StreamableFile,
} from '@nestjs/common';
import path from 'node:path';

import {
  buildWebpVariantKey,
  resolveAllowedMaxEdge,
  resizeToWebpMaxEdge,
} from '../images/image-variants';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';

function normalizeStorageKey(rawKey: string): string {
  const key = rawKey.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!key) {
    throw new BadRequestException('Storage key is required.');
  }

  const segments = key.split('/').filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    throw new BadRequestException('Storage key must include user prefix.');
  }

  if (segments.some((segment) => segment === '..')) {
    throw new BadRequestException('Storage key cannot include parent path segments.');
  }

  return segments.join('/');
}

function guessContentTypeFromKey(key: string): string | null {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return null;
  }
}

@Controller('me/avatar')
export class MeAvatarPublicController {
  constructor(@Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider) {}

  @Get('assets')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async getAsset(
    @Query('key') key: string | undefined,
    @Query('maxEdge') maxEdgeRaw: string | undefined,
  ) {
    const rawKey = key?.trim();
    if (!rawKey) {
      throw new BadRequestException('Query parameter "key" is required.');
    }

    const normalizedKey = normalizeStorageKey(rawKey);
    const segments = normalizedKey.split('/');
    if (segments[1] !== 'user-avatar') {
      throw new BadRequestException('Unsupported asset key.');
    }

    const result = await this.storageProvider.getObject(normalizedKey);
    const contentType =
      result.contentType ?? guessContentTypeFromKey(normalizedKey) ?? 'application/octet-stream';
    const maxEdge = resolveAllowedMaxEdge(maxEdgeRaw ? Number(maxEdgeRaw) : undefined);

    if (maxEdge && contentType.startsWith('image/')) {
      const variantKey = buildWebpVariantKey(normalizedKey, maxEdge);
      try {
        const variantObject = await this.storageProvider.getObject(variantKey);
        return new StreamableFile(variantObject.body, {
          type: variantObject.contentType ?? 'image/webp',
        });
      } catch {
        const resized = await resizeToWebpMaxEdge({ body: result.body, maxEdge });
        void this.storageProvider
          .putObject({
            key: variantKey,
            body: resized.body,
            contentType: resized.contentType,
            metadata: {
              source: 'user-avatar-variant',
              originalKey: normalizedKey,
              maxEdge: String(maxEdge),
            },
          })
          .catch(() => undefined);

        return new StreamableFile(resized.body, {
          type: resized.contentType,
        });
      }
    }

    return new StreamableFile(result.body, {
      type: contentType,
    });
  }
}
