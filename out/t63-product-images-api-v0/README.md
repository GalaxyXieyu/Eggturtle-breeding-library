# T63 Product Images API v0 - Manual Verification

## Assumptions

- API base URL is `http://localhost:3001` (change to your env if needed).
- You already have a valid tenant-scoped access token.
- All requests include `Authorization: Bearer <TOKEN>`.
- If your local setup uses cookie auth via proxy, add `-H 'Cookie: <YOUR_COOKIE>'` in addition to Bearer token.
- `PRODUCT_ID` belongs to the same tenant as the token.

```bash
export API_BASE="http://localhost:3001"
export TOKEN="<PASTE_ACCESS_TOKEN>"
export PRODUCT_ID="<existing_product_id>"
```

## 1) List product images

```bash
curl -sS "$API_BASE/products/$PRODUCT_ID/images" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected:
- HTTP 200
- JSON body like `{ "images": [...] }`
- ordered by `sortOrder` ascending

## 2) Upload image

```bash
curl -sS -X POST "$API_BASE/products/$PRODUCT_ID/images" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./tmp/test-image.png" | jq
```

Expected:
- HTTP 201
- JSON body includes `image.id`, `image.url`, `image.isMain`

Save uploaded IDs for next steps:

```bash
export IMAGE_ID_A="<first_uploaded_image_id>"
export IMAGE_ID_B="<second_uploaded_image_id>"
```

## 3) Set main image

```bash
curl -sS -X PUT "$API_BASE/products/$PRODUCT_ID/images/$IMAGE_ID_B/main" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected:
- HTTP 200
- Returned `image.id == IMAGE_ID_B`
- Returned `image.isMain == true`

## 4) Reorder images

```bash
curl -sS -X PUT "$API_BASE/products/$PRODUCT_ID/images/reorder" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageIds":["'"$IMAGE_ID_B"'","'"$IMAGE_ID_A"'"]}' | jq
```

Expected:
- HTTP 200
- `images[0].id == IMAGE_ID_B`
- `images[1].id == IMAGE_ID_A`

## 5) Verify list reflects main + order

```bash
curl -sS "$API_BASE/products/$PRODUCT_ID/images" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected:
- HTTP 200
- first image is `IMAGE_ID_B`
- first image has `isMain: true`

## 6) Delete image

```bash
curl -sS -X DELETE "$API_BASE/products/$PRODUCT_ID/images/$IMAGE_ID_B" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected:
- HTTP 200
- body includes `{ "deleted": true, "imageId": "..." }`

## 7) Deleted image content should 404

```bash
curl -i -sS "$API_BASE/products/$PRODUCT_ID/images/$IMAGE_ID_B/content" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- HTTP 404
- error code `PRODUCT_IMAGE_NOT_FOUND`
