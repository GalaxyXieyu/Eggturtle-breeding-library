# Milestone 1 smoke note (Series + Breeders read-only)

Base URL: `http://localhost:30011`

## Preconditions

1. Start API service (and DB migrated):

```bash
pnpm --filter @eggturtle/api prisma:migrate
pnpm --filter @eggturtle/api dev
```

2. Get an authenticated tenant token (viewer+ role):

```bash
curl -s -X POST http://localhost:30011/auth/request-code \
  -H 'content-type: application/json' \
  -d '{"email":"dev@example.com"}'

# In local dev, verify with devCode from response
curl -s -X POST http://localhost:30011/auth/verify-code \
  -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","code":"<DEV_CODE>"}'
```

3. Export token and ids:

```bash
export TOKEN='<ACCESS_TOKEN>'
export SERIES_ID='<SERIES_ID>'
export BREEDER_ID='<BREEDER_ID>'
export BREEDER_CODE='<BREEDER_CODE>'
```

## Read-only endpoint checks

```bash
# Series list (search + pagination)
curl -s 'http://localhost:30011/series?search=cb&page=1&pageSize=20' \
  -H "authorization: Bearer $TOKEN"

# Series detail
curl -s "http://localhost:30011/series/$SERIES_ID" \
  -H "authorization: Bearer $TOKEN"

# Breeders list (filters: seriesId/search/code)
curl -s "http://localhost:30011/breeders?seriesId=$SERIES_ID&search=cb&page=1&pageSize=20" \
  -H "authorization: Bearer $TOKEN"

curl -s "http://localhost:30011/breeders?code=$BREEDER_CODE" \
  -H "authorization: Bearer $TOKEN"

# Breeder lookup by code
curl -s "http://localhost:30011/breeders/by-code/$BREEDER_CODE" \
  -H "authorization: Bearer $TOKEN"

# Breeder detail
curl -s "http://localhost:30011/breeders/$BREEDER_ID" \
  -H "authorization: Bearer $TOKEN"

# Breeder events (empty [] is acceptable for this slice)
curl -s "http://localhost:30011/breeders/$BREEDER_ID/events" \
  -H "authorization: Bearer $TOKEN"

# Breeder family tree (simple immediate-relations version)
curl -s "http://localhost:30011/breeders/$BREEDER_ID/family-tree" \
  -H "authorization: Bearer $TOKEN"
```

## Expected notes

- All endpoints require authenticated tenant member token (AuthGuard + RbacGuard + VIEWER).
- `/breeders/:id/events` is tenant-scoped and may return `{"events":[]}`.
- `/breeders/:id/family-tree` currently returns self + immediate relations only, with a `limitations` explanation field.
