#!/usr/bin/env bash
set -euo pipefail

API_BASE="http://localhost:30011"
ALLOW_REMOTE=0
CONFIRM=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)
      API_BASE="${2:-}"
      shift 2
      ;;
    --allow-remote)
      ALLOW_REMOTE=1
      shift
      ;;
    --confirm)
      CONFIRM=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/smoke/api_smoke.sh [options]

Options:
  --api-base <url>   API base URL (default: http://localhost:30011)
  --allow-remote     Allow non-local API base URL
  --confirm          Execute smoke writes (default is dry-run)
  -h, --help         Show help

Notes:
- Requires curl + jq.
- Requires API dev mode with AUTH_DEV_CODE_ENABLED=true so request-code returns devCode.
- Creates one tenant + one product for smoke assertions when --confirm is set.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

if [[ "$ALLOW_REMOTE" -ne 1 ]]; then
  if [[ ! "$API_BASE" =~ ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]]; then
    echo "Refusing non-local API base URL without --allow-remote: $API_BASE" >&2
    exit 1
  fi
fi

echo "Smoke plan:"
echo "- mode: $([[ "$CONFIRM" -eq 1 ]] && echo "WRITE" || echo "DRY-RUN (default)")"
echo "- api-base: $API_BASE"

if [[ "$CONFIRM" -ne 1 ]]; then
  echo "No requests sent. Re-run with --confirm to execute smoke flow."
  exit 0
fi

request_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local token="${4:-}"
  local tmp_body
  tmp_body="$(mktemp)"

  local url="${API_BASE}${path}"
  local status

  if [[ -n "$token" ]]; then
    if [[ -n "$payload" ]]; then
      status="$(curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
        -H "authorization: Bearer $token" \
        -H "content-type: application/json" \
        -d "$payload")"
    else
      status="$(curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
        -H "authorization: Bearer $token")"
    fi
  else
    if [[ -n "$payload" ]]; then
      status="$(curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
        -H "content-type: application/json" \
        -d "$payload")"
    else
      status="$(curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url")"
    fi
  fi

  echo "$status" >"${tmp_body}.status"
  printf "%s" "$tmp_body"
}

assert_status() {
  local body_file="$1"
  local expected_status="$2"
  local actual_status
  actual_status="$(cat "${body_file}.status")"
  if [[ "$actual_status" != "$expected_status" ]]; then
    echo "Expected HTTP $expected_status, got $actual_status" >&2
    cat "$body_file" >&2
    exit 1
  fi
}

cleanup_files() {
  local file
  for file in "$@"; do
    rm -f "$file" "${file}.status"
  done
}

TIMESTAMP="$(date +%s)"
EMAIL="smoke-${TIMESTAMP}@example.com"
TENANT_SLUG="smoke-${TIMESTAMP}"
PRODUCT_CODE="SMOKE-${TIMESTAMP}"

echo "[1/11] health"
health_body="$(request_json GET /health)"
assert_status "$health_body" 200
jq -e '.status == "ok"' "$health_body" >/dev/null
cleanup_files "$health_body"

echo "[2/11] request auth code"
request_code_payload="{\"email\":\"${EMAIL}\"}"
request_code_body="$(request_json POST /auth/request-code "$request_code_payload")"
assert_status "$request_code_body" 201
DEV_CODE="$(jq -r '.devCode // empty' "$request_code_body")"
if [[ -z "$DEV_CODE" ]]; then
  echo "devCode missing. Ensure AUTH_DEV_CODE_ENABLED=true and NODE_ENV=development." >&2
  cat "$request_code_body" >&2
  exit 1
fi
cleanup_files "$request_code_body"

echo "[3/11] verify auth code"
verify_payload="{\"email\":\"${EMAIL}\",\"code\":\"${DEV_CODE}\"}"
verify_body="$(request_json POST /auth/verify-code "$verify_payload")"
assert_status "$verify_body" 201
BASE_TOKEN="$(jq -r '.accessToken' "$verify_body")"
if [[ -z "$BASE_TOKEN" || "$BASE_TOKEN" == "null" ]]; then
  echo "verify-code did not return accessToken" >&2
  cat "$verify_body" >&2
  exit 1
fi
cleanup_files "$verify_body"

echo "[4/11] create tenant"
create_tenant_payload="{\"slug\":\"${TENANT_SLUG}\",\"name\":\"Smoke Tenant ${TIMESTAMP}\"}"
create_tenant_body="$(request_json POST /tenants "$create_tenant_payload" "$BASE_TOKEN")"
assert_status "$create_tenant_body" 201
TENANT_ID="$(jq -r '.tenant.id' "$create_tenant_body")"
if [[ -z "$TENANT_ID" || "$TENANT_ID" == "null" ]]; then
  echo "create tenant failed" >&2
  cat "$create_tenant_body" >&2
  exit 1
fi
cleanup_files "$create_tenant_body"

echo "[5/11] switch tenant"
switch_payload="{\"tenantId\":\"${TENANT_ID}\"}"
switch_body="$(request_json POST /auth/switch-tenant "$switch_payload" "$BASE_TOKEN")"
assert_status "$switch_body" 201
TOKEN="$(jq -r '.accessToken' "$switch_body")"
if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "switch-tenant failed" >&2
  cat "$switch_body" >&2
  exit 1
fi
cleanup_files "$switch_body"

echo "[6/11] create product"
create_product_payload="{\"code\":\"${PRODUCT_CODE}\",\"name\":\"Smoke Product\",\"description\":\"API smoke test\"}"
create_product_body="$(request_json POST /products "$create_product_payload" "$TOKEN")"
assert_status "$create_product_body" 201
PRODUCT_ID="$(jq -r '.product.id' "$create_product_body")"
if [[ -z "$PRODUCT_ID" || "$PRODUCT_ID" == "null" ]]; then
  echo "create product failed" >&2
  cat "$create_product_body" >&2
  exit 1
fi
cleanup_files "$create_product_body"

echo "[7/11] list products"
list_products_body="$(request_json GET /products "" "$TOKEN")"
assert_status "$list_products_body" 200
jq -e --arg product_id "$PRODUCT_ID" '.products[] | select(.id == $product_id)' "$list_products_body" >/dev/null
cleanup_files "$list_products_body"

echo "[8/11] featured products"
create_featured_payload="{\"productId\":\"${PRODUCT_ID}\"}"
create_featured_body="$(request_json POST /featured-products "$create_featured_payload" "$TOKEN")"
assert_status "$create_featured_body" 201
FEATURED_ID="$(jq -r '.item.id' "$create_featured_body")"
if [[ -z "$FEATURED_ID" || "$FEATURED_ID" == "null" ]]; then
  echo "create featured product failed" >&2
  cat "$create_featured_body" >&2
  exit 1
fi
cleanup_files "$create_featured_body"

list_featured_body="$(request_json GET /featured-products "" "$TOKEN")"
assert_status "$list_featured_body" 200
jq -e --arg featured_id "$FEATURED_ID" '.items[] | select(.id == $featured_id)' "$list_featured_body" >/dev/null
cleanup_files "$list_featured_body"

public_featured_body="$(request_json GET "/products/featured?tenantSlug=${TENANT_SLUG}")"
assert_status "$public_featured_body" 200
jq -e --arg product_id "$PRODUCT_ID" '.products[] | select(.id == $product_id)' "$public_featured_body" >/dev/null
cleanup_files "$public_featured_body"

echo "[9/11] create share"
create_share_payload="{\"resourceType\":\"product\",\"resourceId\":\"${PRODUCT_ID}\"}"
create_share_body="$(request_json POST /shares "$create_share_payload" "$TOKEN")"
assert_status "$create_share_body" 201
SHARE_ID="$(jq -r '.share.id' "$create_share_body")"
SHARE_TOKEN="$(jq -r '.share.shareToken' "$create_share_body")"
if [[ -z "$SHARE_ID" || "$SHARE_ID" == "null" || -z "$SHARE_TOKEN" || "$SHARE_TOKEN" == "null" ]]; then
  echo "create share failed" >&2
  cat "$create_share_body" >&2
  exit 1
fi
cleanup_files "$create_share_body"

echo "[10/11] share redirect"
redirect_headers="$(mktemp)"
redirect_status="$(curl -sS -D "$redirect_headers" -o /dev/null -w "%{http_code}" "${API_BASE}/s/${SHARE_TOKEN}")"
if [[ "$redirect_status" != "302" ]]; then
  echo "Expected 302 from /s/{shareToken}, got $redirect_status" >&2
  cat "$redirect_headers" >&2
  exit 1
fi
REDIRECT_LOCATION="$(awk 'tolower($1) == "location:" { print $2 }' "$redirect_headers" | tr -d '\r')"
if [[ -z "$REDIRECT_LOCATION" ]]; then
  echo "Missing Location header from share redirect" >&2
  cat "$redirect_headers" >&2
  exit 1
fi
rm -f "$redirect_headers"

echo "[11/11] share public payload"
# shellcheck disable=SC2016
eval "$(python3 - <<'PY'
from urllib.parse import urlparse, parse_qs
import os
location = os.environ['REDIRECT_LOCATION']
params = parse_qs(urlparse(location).query)
for key in ['sid', 'tenantId', 'resourceType', 'resourceId', 'exp', 'sig']:
    value = params.get(key, [''])[0]
    print(f'{key.upper()}="{value}"')
PY
)"

if [[ -z "${SID:-}" || -z "${TENANTID:-}" || -z "${RESOURCETYPE:-}" || -z "${RESOURCEID:-}" || -z "${EXP:-}" || -z "${SIG:-}" ]]; then
  echo "Redirect URL missing required signed parameters" >&2
  echo "$REDIRECT_LOCATION" >&2
  exit 1
fi

public_share_path="/shares/${SID}/public?tenantId=${TENANTID}&resourceType=${RESOURCETYPE}&resourceId=${RESOURCEID}&exp=${EXP}&sig=${SIG}"
public_share_body="$(request_json GET "$public_share_path")"
assert_status "$public_share_body" 200
jq -e --arg share_id "$SHARE_ID" '.shareId == $share_id' "$public_share_body" >/dev/null
jq -e --arg product_id "$PRODUCT_ID" '.product.id == $product_id' "$public_share_body" >/dev/null
cleanup_files "$public_share_body"

echo "Smoke OK"
echo "- tenantSlug=${TENANT_SLUG}"
echo "- productId=${PRODUCT_ID}"
echo "- shareId=${SHARE_ID}"
