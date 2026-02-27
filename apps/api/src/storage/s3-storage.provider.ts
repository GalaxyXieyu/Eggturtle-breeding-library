import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

import type {
  GetObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageProvider
} from './storage.provider';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly signedUrlExpiresInSeconds: number;
  private client: S3Client | null = null;
  private bucket: string | null = null;

  constructor() {
    this.signedUrlExpiresInSeconds = this.parseSignedUrlTtl(
      process.env.S3_SIGNED_URL_EXPIRES_IN_SECONDS
    );
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const key = this.normalizeKey(input.key);
    const { client, bucket } = this.getClientAndBucket();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.body,
          ContentType: input.contentType?.trim() || undefined
        })
      );
    } catch (error) {
      throw this.rethrowAsStorageError(error);
    }

    return {
      key,
      url: `s3://${bucket}/${key}`,
      contentType: input.contentType?.trim() || null
    };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const normalizedKey = this.normalizeKey(key);
    const { client, bucket } = this.getClientAndBucket();

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: normalizedKey
        })
      );

      if (!response.Body) {
        throw new NotFoundException('Stored object was not found.');
      }

      return {
        body: await this.toBuffer(response.Body),
        contentType: response.ContentType?.trim() || null
      };
    } catch (error) {
      if (this.isMissingObjectError(error)) {
        throw new NotFoundException('Stored object was not found.');
      }

      throw this.rethrowAsStorageError(error);
    }
  }

  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    const { client, bucket } = this.getClientAndBucket();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: normalizedKey
    });

    try {
      return await getS3SignedUrl(client, command, {
        expiresIn: expiresInSeconds ?? this.signedUrlExpiresInSeconds
      });
    } catch (error) {
      throw this.rethrowAsStorageError(error);
    }
  }

  async deleteObject(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const { client, bucket } = this.getClientAndBucket();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: normalizedKey
        })
      );
    } catch (error) {
      throw this.rethrowAsStorageError(error);
    }
  }

  private getClientAndBucket(): { client: S3Client; bucket: string } {
    if (this.client && this.bucket) {
      return {
        client: this.client,
        bucket: this.bucket
      };
    }

    const bucket = this.requireEnv('S3_BUCKET');
    const client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: this.parseBooleanEnv('S3_FORCE_PATH_STYLE', true),
      credentials: {
        accessKeyId: this.requireEnv('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.requireEnv('S3_SECRET_ACCESS_KEY')
      }
    });

    this.client = client;
    this.bucket = bucket;

    return { client, bucket };
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

  private parseBooleanEnv(name: string, fallback: boolean): boolean {
    const value = process.env[name];
    if (!value) {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private isMissingObjectError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    // AWS SDK v3 error shapes vary by runtime, bundling, and S3-compatible servers (MinIO).
    // Prefer checking error name/code + HTTP status code over `instanceof`.
    const maybeError = error as {
      name?: string;
      code?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number };
    };

    if (maybeError.$metadata?.httpStatusCode === 404) {
      return true;
    }

    const tag = String(maybeError.name || maybeError.code || maybeError.Code || '');
    return tag === 'NoSuchKey' || tag === 'NotFound';
  }

  private parseSignedUrlTtl(rawValue: string | undefined): number {
    if (!rawValue) {
      return 300;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new InternalServerErrorException('S3_SIGNED_URL_EXPIRES_IN_SECONDS must be a positive number.');
    }

    return Math.floor(parsed);
  }

  private requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${name} is required when STORAGE_PROVIDER=s3.`);
    }

    return value;
  }

  private async toBuffer(body: unknown): Promise<Buffer> {
    if (Buffer.isBuffer(body)) {
      return body;
    }

    if (body instanceof Uint8Array) {
      return Buffer.from(body);
    }

    if (typeof body === 'string') {
      return Buffer.from(body);
    }

    if (body && typeof body === 'object' && 'transformToByteArray' in body) {
      const maybeBody = body as { transformToByteArray: () => Promise<Uint8Array> };
      const bytes = await maybeBody.transformToByteArray();
      return Buffer.from(bytes);
    }

    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    throw new InternalServerErrorException('Unsupported object body type returned by storage provider.');
  }

  private rethrowAsStorageError(error: unknown): Error {
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      return error;
    }

    if (error instanceof Error) {
      return new InternalServerErrorException(`Storage operation failed: ${error.message}`);
    }

    return new InternalServerErrorException('Storage operation failed.');
  }
}
