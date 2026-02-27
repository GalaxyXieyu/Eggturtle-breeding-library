import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { PutObjectInput, PutObjectResult, StorageProvider } from './storage.provider';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly uploadRoot: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? '.data/uploads');
    this.publicBaseUrl = (process.env.UPLOAD_PUBLIC_BASE_URL ?? '/uploads').replace(/\/+$/, '');
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const key = this.normalizeKey(input.key);
    const targetPath = path.join(this.uploadRoot, key);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, input.body);

    return {
      key,
      url: await this.getSignedUrl(key),
      contentType: input.contentType?.trim() || null
    };
  }

  async getSignedUrl(key: string): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    const encodedKey = normalizedKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');

    return `${this.publicBaseUrl}/${encodedKey}`;
  }

  async deleteObject(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const targetPath = path.join(this.uploadRoot, normalizedKey);

    try {
      await fs.unlink(targetPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private normalizeKey(rawKey: string): string {
    const key = rawKey.replace(/\\/g, '/').replace(/^\/+/, '').trim();

    if (!key) {
      throw new BadRequestException('Storage key is required.');
    }

    const segments = key.split('/').filter((segment) => segment.length > 0);
    if (segments.length < 2) {
      throw new BadRequestException('Storage key must include tenant prefix.');
    }

    if (segments.some((segment) => segment === '..')) {
      throw new BadRequestException('Storage key cannot include parent path segments.');
    }

    return segments.join('/');
  }
}
