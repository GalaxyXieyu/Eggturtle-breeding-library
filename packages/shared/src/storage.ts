import { z } from 'zod';

export const storageObjectKeySchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[^\s]+$/, 'Storage key cannot contain spaces.')
  .refine((value) => value.includes('/'), {
    message: 'Storage key must include tenant prefix.'
  });

export const storagePutObjectRequestSchema = z.object({
  key: storageObjectKeySchema,
  contentType: z.string().trim().min(1).max(255).optional()
});

export const storagePutObjectResponseSchema = z.object({
  key: storageObjectKeySchema,
  url: z.string().trim().min(1),
  contentType: z.string().trim().min(1).nullable()
});

export const storageGetSignedUrlResponseSchema = z.object({
  url: z.string().trim().min(1)
});

export type StoragePutObjectRequest = z.infer<typeof storagePutObjectRequestSchema>;
export type StoragePutObjectResponse = z.infer<typeof storagePutObjectResponseSchema>;
export type StorageGetSignedUrlResponse = z.infer<typeof storageGetSignedUrlResponseSchema>;
