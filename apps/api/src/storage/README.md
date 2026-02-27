# Storage providers (MVP)

## Local disk (default)

- Select with `STORAGE_PROVIDER=local` (or omit it).
- Upload root: `UPLOAD_DIR` (default `./.data/uploads`).
- Public URL base: `UPLOAD_PUBLIC_BASE_URL` (default `/uploads`).

## S3 (stub)

`S3StorageProvider` is intentionally a non-running placeholder in this MVP.

To finish later:

1. Inject AWS SDK client + bucket config.
2. Implement `putObject` / `getSignedUrl` / `deleteObject`.
3. Switch runtime with `STORAGE_PROVIDER=s3`.
