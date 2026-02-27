import { Module } from '@nestjs/common';

import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER_TOKEN } from './storage.constants';

@Module({
  providers: [
    LocalDiskStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (
        localDiskStorageProvider: LocalDiskStorageProvider,
        s3StorageProvider: S3StorageProvider
      ) => {
        const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();

        if (provider === 's3') {
          return s3StorageProvider;
        }

        return localDiskStorageProvider;
      },
      inject: [LocalDiskStorageProvider, S3StorageProvider]
    }
  ],
  exports: [STORAGE_PROVIDER_TOKEN]
})
export class StorageModule {}
