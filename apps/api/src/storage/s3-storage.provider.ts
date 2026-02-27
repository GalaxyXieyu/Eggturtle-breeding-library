import { Injectable, NotImplementedException } from '@nestjs/common';

import type { PutObjectInput, PutObjectResult, StorageProvider } from './storage.provider';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    void input;
    throw new NotImplementedException('S3StorageProvider.putObject is not implemented yet.');
  }

  async getSignedUrl(key: string): Promise<string> {
    void key;
    throw new NotImplementedException('S3StorageProvider.getSignedUrl is not implemented yet.');
  }

  async deleteObject(key: string): Promise<void> {
    void key;
    throw new NotImplementedException('S3StorageProvider.deleteObject is not implemented yet.');
  }
}
