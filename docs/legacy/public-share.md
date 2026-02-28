# T13 Public Share Page

## Endpoints

- `POST /shares` (auth required)
  - Create or reuse a stable share token for a resource.
  - Body:
    ```json
    {
      "resourceType": "product",
      "resourceId": "<productId>"
    }
    ```
- `GET /s/:shareToken` (public)
  - Stable public entry URL.
  - Returns `302` to a short-lived signed URL:
    - `${WEB_PUBLIC_BASE_URL}/public/share?sid=<shareId>&tenantId=<tenantId>&resourceType=product&resourceId=<productId>&exp=<unixSeconds>&sig=<hmac>`
- `GET /shares/:shareId/public?tenantId=...&resourceType=product&resourceId=...&exp=...&sig=...` (public)
  - Verifies HMAC signature + expiry and returns public share data for rendering.
  - For managed storage keys (tenant-prefixed object keys), image URLs are returned as short-lived signed URLs so PG + MinIO deployments can render images without exposing buckets publicly.

## Curl Flow

1) Create share link (authenticated)

```bash
curl -sS -X POST "http://localhost:30011/shares" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"resourceType":"product","resourceId":"<PRODUCT_ID>"}'
```

Expected response includes stable entry URL:

```json
{
  "share": {
    "id": "...",
    "tenantId": "...",
    "resourceType": "product",
    "resourceId": "...",
    "shareToken": "shr_...",
    "entryUrl": "http://localhost:30011/s/shr_...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

2) Open public share entry (no auth)

```bash
curl -i "http://localhost:30011/s/<SHARE_TOKEN>"
```

Expected: `HTTP/1.1 302 Found` with `Location: http://localhost:30010/public/share?...&exp=...&sig=...`

3) Open in browser

- Visit `http://localhost:30011/s/<SHARE_TOKEN>`
- Browser is redirected to `/public/share?...`
- Public page fetches `/shares/:shareId/public?...` and renders tenant + product content without auth.

## Local Verification Checklist

1. Apply DB migration:

```bash
pnpm --filter @eggturtle/api prisma:deploy
```

2. Set env vars in `apps/api/.env`:

```bash
PUBLIC_SHARE_SIGNING_SECRET=<non-empty-secret>
WEB_PUBLIC_BASE_URL=http://localhost:30010
API_PUBLIC_BASE_URL=http://localhost:30011
```

3. Start apps:

```bash
pnpm --filter @eggturtle/api dev
pnpm --filter @eggturtle/web dev
```

4. Use the curl flow above and verify:
- `POST /shares` works with auth.
- `GET /s/:shareToken` returns `302`.
- `GET /shares/:shareId/public?...` works before expiry and fails after expiry.
- Audit logs include `share.create` and `share.access` entries.
