# Storage providers

## Local disk (default)

- Select with `STORAGE_PROVIDER=local` (or omit it).
- Upload root: `UPLOAD_DIR` (default `./.data/uploads`).
- Public URL base: `UPLOAD_PUBLIC_BASE_URL` (default `/uploads`).

## S3 / MinIO

- Select with `STORAGE_PROVIDER=s3`.
- Required env vars:
  - `S3_ENDPOINT` (for local MinIO, e.g. `http://127.0.0.1:30002`)
  - `S3_REGION` (commonly `us-east-1` for MinIO)
  - `S3_BUCKET`
  - `S3_ACCESS_KEY_ID`
  - `S3_SECRET_ACCESS_KEY`
- Recommended for MinIO: `S3_FORCE_PATH_STYLE=true`.

The provider supports `putObject`, `getObject`, `getSignedUrl`, and `deleteObject`.
Managed image reads are proxied through the API (`GET /products/:pid/images/:iid/content`) so MinIO does not need to be publicly exposed.
