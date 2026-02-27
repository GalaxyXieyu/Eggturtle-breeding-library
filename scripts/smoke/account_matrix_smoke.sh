#!/usr/bin/env bash
set -euo pipefail

API_BASE="http://localhost:30011"
ALLOW_REMOTE=0
CONFIRM_WRITES=0
PROVISION=0
REQUIRE_SUPER_ADMIN_PASS=0

OWNER_EMAIL=""
ADMIN_EMAIL=""
EDITOR_EMAIL=""
VIEWER_EMAIL=""
SUPER_ADMIN_EMAIL=""
TENANT_ID=""
TENANT_SLUG=""
TENANT_NAME=""

usage() {
  cat <<'EOF'
Usage: scripts/smoke/account_matrix_smoke.sh [options]

Options:
  --api-base <url>                 API base URL (default: http://localhost:30011)
  --allow-remote                   Allow non-local API base URL
  --confirm-writes                 Execute verification flow (default is dry-run)
  --provision                      Create tenant + role memberships via super-admin
  --require-super-admin-pass       Fail when super-admin positive checks are not 2xx
  --owner-email <email>            OWNER account email (required)
  --admin-email <email>            ADMIN account email (required)
  --editor-email <email>           EDITOR account email (required)
  --viewer-email <email>           VIEWER account email (required)
  --super-admin-email <email>      super-admin email (required for --provision)
  --tenant-id <id>                 Existing tenant ID (required unless --provision)
  --tenant-slug <slug>             Tenant slug for --provision (default: t23-matrix-<ts>)
  --tenant-name <name>             Tenant name for --provision (default: T23 Matrix <ts>)
  -h, --help                       Show help

Notes:
- Requires curl + jq + python3.
- Requires API dev code flow (AUTH_DEV_CODE_ENABLED=true in development),
  because /auth/request-code must return devCode.
- Writes are blocked by default; pass --confirm-writes to run.
- By default only localhost/127.0.0.1 API is allowed.
EOF
}

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
    --confirm-writes)
      CONFIRM_WRITES=1
      shift
      ;;
    --provision)
      PROVISION=1
      shift
      ;;
    --require-super-admin-pass)
      REQUIRE_SUPER_ADMIN_PASS=1
      shift
      ;;
    --owner-email)
      OWNER_EMAIL="${2:-}"
      shift 2
      ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --editor-email)
      EDITOR_EMAIL="${2:-}"
      shift 2
      ;;
    --viewer-email)
      VIEWER_EMAIL="${2:-}"
      shift 2
      ;;
    --super-admin-email)
      SUPER_ADMIN_EMAIL="${2:-}"
      shift 2
      ;;
    --tenant-id)
      TENANT_ID="${2:-}"
      shift 2
      ;;
    --tenant-slug)
      TENANT_SLUG="${2:-}"
      shift 2
      ;;
    --tenant-name)
      TENANT_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

for cmd in curl jq python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required." >&2
    exit 1
  fi
done

if [[ -z "$OWNER_EMAIL" || -z "$ADMIN_EMAIL" || -z "$EDITOR_EMAIL" || -z "$VIEWER_EMAIL" ]]; then
  echo "owner/admin/editor/viewer emails are required." >&2
  exit 1
fi

if [[ "$PROVISION" -eq 1 ]]; then
  if [[ -z "$SUPER_ADMIN_EMAIL" ]]; then
    echo "--super-admin-email is required when --provision is enabled." >&2
    exit 1
  fi
else
  if [[ -z "$TENANT_ID" ]]; then
    echo "--tenant-id is required unless --provision is enabled." >&2
    exit 1
  fi
fi

if [[ "$ALLOW_REMOTE" -ne 1 ]]; then
  if [[ ! "$API_BASE" =~ ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]]; then
    echo "Refusing non-local API base URL without --allow-remote: $API_BASE" >&2
    exit 1
  fi
fi

TIMESTAMP="$(date +%s)"
if [[ -z "$TENANT_SLUG" ]]; then
  TENANT_SLUG="t23-matrix-${TIMESTAMP}"
fi
if [[ -z "$TENANT_NAME" ]]; then
  TENANT_NAME="T23 Matrix ${TIMESTAMP}"
fi

echo "T23 account matrix smoke plan:"
echo "- mode: $([[ "$CONFIRM_WRITES" -eq 1 ]] && echo "WRITE" || echo "DRY-RUN (default)")"
echo "- api-base: $API_BASE"
echo "- provision: $([[ "$PROVISION" -eq 1 ]] && echo "yes" || echo "no")"
echo "- tenant-id: ${TENANT_ID:-<to-be-created>}"
echo "- roles: OWNER=${OWNER_EMAIL}, ADMIN=${ADMIN_EMAIL}, EDITOR=${EDITOR_EMAIL}, VIEWER=${VIEWER_EMAIL}"
echo "- super-admin: ${SUPER_ADMIN_EMAIL:-<not-provided>}"

if [[ "$CONFIRM_WRITES" -ne 1 ]]; then
  echo "No requests sent. Re-run with --confirm-writes to execute." 
  exit 0
fi

TMP_FILES=()
TMP_IMAGE=""
TMP_HEADERS=""

cleanup() {
  local file
  for file in "${TMP_FILES[@]:-}"; do
    rm -f "$file"
  done
  if [[ -n "$TMP_IMAGE" ]]; then
    rm -f "$TMP_IMAGE"
  fi
  if [[ -n "$TMP_HEADERS" ]]; then
    rm -f "$TMP_HEADERS"
  fi
}
trap cleanup EXIT

new_tmp() {
  local file
  file="$(mktemp)"
  TMP_FILES+=("$file" "${file}.status")
  printf '%s' "$file"
}

request_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local token="${4:-}"
  local body_file
  body_file="$(new_tmp)"

  local url="${API_BASE}${path}"
  local status

  if [[ -n "$token" ]]; then
    if [[ -n "$payload" ]]; then
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
        -H "authorization: Bearer $token" \
        -H "content-type: application/json" \
        -d "$payload")"
    else
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
        -H "authorization: Bearer $token")"
    fi
  else
    if [[ -n "$payload" ]]; then
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
        -H "content-type: application/json" \
        -d "$payload")"
    else
      status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url")"
    fi
  fi

  echo "$status" >"${body_file}.status"
  printf '%s' "$body_file"
}

request_multipart_file() {
  local path="$1"
  local token="$2"
  local file_path="$3"
  local body_file
  body_file="$(new_tmp)"

  local status
  status="$(curl -sS -o "$body_file" -w "%{http_code}" -X POST "${API_BASE}${path}" \
    -H "authorization: Bearer $token" \
    -F "file=@${file_path};type=image/png")"

  echo "$status" >"${body_file}.status"
  printf '%s' "$body_file"
}

request_status_only() {
  local method="$1"
  local path="$2"
  local token="${3:-}"

  if [[ -n "$token" ]]; then
    curl -sS -o /dev/null -w "%{http_code}" -X "$method" "${API_BASE}${path}" \
      -H "authorization: Bearer $token"
  else
    curl -sS -o /dev/null -w "%{http_code}" -X "$method" "${API_BASE}${path}"
  fi
}

assert_status() {
  local body_file="$1"
  local expected="$2"
  local actual
  actual="$(cat "${body_file}.status")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected HTTP ${expected}, got ${actual}" >&2
    cat "$body_file" >&2
    exit 1
  fi
}

assert_status_one_of() {
  local actual="$1"
  shift
  local expected
  for expected in "$@"; do
    if [[ "$actual" == "$expected" ]]; then
      return 0
    fi
  done

  echo "Expected one of HTTP [$*], got ${actual}" >&2
  exit 1
}

assert_error_code() {
  local body_file="$1"
  local expected_code="$2"
  local actual_code
  actual_code="$(jq -r '.errorCode // empty' "$body_file")"

  if [[ "$actual_code" != "$expected_code" ]]; then
    echo "Expected errorCode=${expected_code}, got ${actual_code:-<empty>}" >&2
    cat "$body_file" >&2
    exit 1
  fi
}

login_with_dev_code() {
  local email="$1"

  local request_payload
  request_payload="$(jq -nc --arg email "$email" '{email:$email}')"

  local request_body
  request_body="$(request_json POST /auth/request-code "$request_payload")"
  assert_status "$request_body" 201

  local dev_code
  dev_code="$(jq -r '.devCode // empty' "$request_body")"
  if [[ -z "$dev_code" ]]; then
    echo "devCode missing for ${email}. Ensure AUTH_DEV_CODE_ENABLED=true and NODE_ENV=development." >&2
    cat "$request_body" >&2
    exit 1
  fi

  local verify_payload
  verify_payload="$(jq -nc --arg email "$email" --arg code "$dev_code" '{email:$email, code:$code}')"

  local verify_body
  verify_body="$(request_json POST /auth/verify-code "$verify_payload")"
  assert_status "$verify_body" 201

  local token
  token="$(jq -r '.accessToken // empty' "$verify_body")"
  if [[ -z "$token" ]]; then
    echo "verify-code did not return accessToken for ${email}" >&2
    cat "$verify_body" >&2
    exit 1
  fi

  printf '%s' "$token"
}

switch_tenant() {
  local base_token="$1"
  local tenant_id="$2"

  local payload
  payload="$(jq -nc --arg tenantId "$tenant_id" '{tenantId:$tenantId}')"

  local body
  body="$(request_json POST /auth/switch-tenant "$payload" "$base_token")"
  assert_status "$body" 201

  local token
  token="$(jq -r '.accessToken // empty' "$body")"
  if [[ -z "$token" ]]; then
    echo "switch-tenant did not return accessToken" >&2
    cat "$body" >&2
    exit 1
  fi

  printf '%s' "$token"
}

create_product_success() {
  local token="$1"
  local role_label="$2"
  local code="T23-${role_label}-${TIMESTAMP}-$RANDOM"
  local payload
  payload="$(jq -nc --arg code "$code" --arg name "T23 ${role_label}" --arg description "account matrix smoke" '{code:$code, name:$name, description:$description}')"

  local body
  body="$(request_json POST /products "$payload" "$token")"
  assert_status "$body" 201

  local product_id
  product_id="$(jq -r '.product.id // empty' "$body")"
  if [[ -z "$product_id" ]]; then
    echo "create product for ${role_label} returned empty product id" >&2
    cat "$body" >&2
    exit 1
  fi

  printf '%s' "$product_id"
}

create_share_success() {
  local token="$1"
  local product_id="$2"

  local payload
  payload="$(jq -nc --arg resourceId "$product_id" '{resourceType:"product", resourceId:$resourceId}')"

  local body
  body="$(request_json POST /shares "$payload" "$token")"
  assert_status "$body" 201

  local share_id
  local share_token
  share_id="$(jq -r '.share.id // empty' "$body")"
  share_token="$(jq -r '.share.shareToken // empty' "$body")"

  if [[ -z "$share_id" || -z "$share_token" ]]; then
    echo "create share returned empty id/token" >&2
    cat "$body" >&2
    exit 1
  fi

  printf '%s,%s' "$share_id" "$share_token"
}

echo "[1/12] health"
health_body="$(request_json GET /health)"
assert_status "$health_body" 200
jq -e '.status == "ok"' "$health_body" >/dev/null

echo "[2/12] login roles"
OWNER_BASE_TOKEN="$(login_with_dev_code "$OWNER_EMAIL")"
ADMIN_BASE_TOKEN="$(login_with_dev_code "$ADMIN_EMAIL")"
EDITOR_BASE_TOKEN="$(login_with_dev_code "$EDITOR_EMAIL")"
VIEWER_BASE_TOKEN="$(login_with_dev_code "$VIEWER_EMAIL")"

SUPER_ADMIN_BASE_TOKEN=""
if [[ -n "$SUPER_ADMIN_EMAIL" ]]; then
  SUPER_ADMIN_BASE_TOKEN="$(login_with_dev_code "$SUPER_ADMIN_EMAIL")"
fi

if [[ "$PROVISION" -eq 1 ]]; then
  echo "[3/12] provision tenant + memberships via super-admin"
  create_tenant_payload="$(jq -nc --arg slug "$TENANT_SLUG" --arg name "$TENANT_NAME" '{slug:$slug, name:$name}')"
  create_tenant_body="$(request_json POST /admin/tenants "$create_tenant_payload" "$SUPER_ADMIN_BASE_TOKEN")"
  assert_status "$create_tenant_body" 201

  TENANT_ID="$(jq -r '.tenant.id // empty' "$create_tenant_body")"
  if [[ -z "$TENANT_ID" ]]; then
    echo "admin create tenant returned empty tenant id" >&2
    cat "$create_tenant_body" >&2
    exit 1
  fi

  for role in OWNER ADMIN EDITOR VIEWER; do
    case "$role" in
      OWNER) member_email="$OWNER_EMAIL" ;;
      ADMIN) member_email="$ADMIN_EMAIL" ;;
      EDITOR) member_email="$EDITOR_EMAIL" ;;
      VIEWER) member_email="$VIEWER_EMAIL" ;;
    esac

    upsert_payload="$(jq -nc --arg email "$member_email" --arg role "$role" '{email:$email, role:$role}')"
    upsert_body="$(request_json POST "/admin/tenants/${TENANT_ID}/members" "$upsert_payload" "$SUPER_ADMIN_BASE_TOKEN")"
    assert_status "$upsert_body" 201
  done
else
  echo "[3/12] use existing tenant: ${TENANT_ID}"
fi

echo "[4/12] switch tenant for role accounts"
OWNER_TOKEN="$(switch_tenant "$OWNER_BASE_TOKEN" "$TENANT_ID")"
ADMIN_TOKEN="$(switch_tenant "$ADMIN_BASE_TOKEN" "$TENANT_ID")"
EDITOR_TOKEN="$(switch_tenant "$EDITOR_BASE_TOKEN" "$TENANT_ID")"
VIEWER_TOKEN="$(switch_tenant "$VIEWER_BASE_TOKEN" "$TENANT_ID")"

echo "[5/12] products read/write matrix"
OWNER_PRODUCT_ID="$(create_product_success "$OWNER_TOKEN" "OWNER")"
ADMIN_PRODUCT_ID="$(create_product_success "$ADMIN_TOKEN" "ADMIN")"
EDITOR_PRODUCT_ID="$(create_product_success "$EDITOR_TOKEN" "EDITOR")"

viewer_create_payload="$(jq -nc --arg code "T23-VIEWER-${TIMESTAMP}-$RANDOM" '{code:$code, name:"viewer should fail"}')"
viewer_create_body="$(request_json POST /products "$viewer_create_payload" "$VIEWER_TOKEN")"
assert_status "$viewer_create_body" 403
assert_error_code "$viewer_create_body" FORBIDDEN

for token in "$OWNER_TOKEN" "$ADMIN_TOKEN" "$EDITOR_TOKEN" "$VIEWER_TOKEN"; do
  list_products_body="$(request_json GET /products "" "$token")"
  assert_status "$list_products_body" 200
done

echo "[6/12] featured-products read/write matrix"
featured_owner_payload="$(jq -nc --arg productId "$OWNER_PRODUCT_ID" '{productId:$productId}')"
featured_admin_payload="$(jq -nc --arg productId "$ADMIN_PRODUCT_ID" '{productId:$productId}')"
featured_editor_payload="$(jq -nc --arg productId "$EDITOR_PRODUCT_ID" '{productId:$productId}')"

featured_owner_body="$(request_json POST /featured-products "$featured_owner_payload" "$OWNER_TOKEN")"
assert_status "$featured_owner_body" 201

featured_admin_body="$(request_json POST /featured-products "$featured_admin_payload" "$ADMIN_TOKEN")"
assert_status "$featured_admin_body" 201

featured_editor_body="$(request_json POST /featured-products "$featured_editor_payload" "$EDITOR_TOKEN")"
assert_status "$featured_editor_body" 201

viewer_featured_body="$(request_json POST /featured-products "$featured_owner_payload" "$VIEWER_TOKEN")"
assert_status "$viewer_featured_body" 403
assert_error_code "$viewer_featured_body" FORBIDDEN

for token in "$OWNER_TOKEN" "$ADMIN_TOKEN" "$EDITOR_TOKEN" "$VIEWER_TOKEN"; do
  list_featured_body="$(request_json GET /featured-products "" "$token")"
  assert_status "$list_featured_body" 200
done

echo "[7/12] shares write matrix"
OWNER_SHARE_DATA="$(create_share_success "$OWNER_TOKEN" "$OWNER_PRODUCT_ID")"
ADMIN_SHARE_DATA="$(create_share_success "$ADMIN_TOKEN" "$ADMIN_PRODUCT_ID")"
EDITOR_SHARE_DATA="$(create_share_success "$EDITOR_TOKEN" "$EDITOR_PRODUCT_ID")"

viewer_share_payload="$(jq -nc --arg resourceId "$OWNER_PRODUCT_ID" '{resourceType:"product", resourceId:$resourceId}')"
viewer_share_body="$(request_json POST /shares "$viewer_share_payload" "$VIEWER_TOKEN")"
assert_status "$viewer_share_body" 403
assert_error_code "$viewer_share_body" FORBIDDEN

OWNER_SHARE_ID="${OWNER_SHARE_DATA%,*}"
OWNER_SHARE_TOKEN="${OWNER_SHARE_DATA#*,}"

echo "[8/12] shares public read"
TMP_HEADERS="$(mktemp)"
share_redirect_status="$(curl -sS -D "$TMP_HEADERS" -o /dev/null -w "%{http_code}" "${API_BASE}/s/${OWNER_SHARE_TOKEN}")"
if [[ "$share_redirect_status" != "302" ]]; then
  echo "Expected 302 from /s/{shareToken}, got ${share_redirect_status}" >&2
  cat "$TMP_HEADERS" >&2
  exit 1
fi

REDIRECT_LOCATION="$(awk 'tolower($1) == "location:" { print $2 }' "$TMP_HEADERS" | tr -d '\r')"
if [[ -z "$REDIRECT_LOCATION" ]]; then
  echo "Missing Location header from /s/{shareToken}" >&2
  cat "$TMP_HEADERS" >&2
  exit 1
fi

# shellcheck disable=SC2016
eval "$(REDIRECT_LOCATION="$REDIRECT_LOCATION" python3 - <<'PY'
from urllib.parse import urlparse, parse_qs
import os

params = parse_qs(urlparse(os.environ['REDIRECT_LOCATION']).query)
for key in ['sid', 'tenantId', 'resourceType', 'resourceId', 'exp', 'sig']:
    print(f'{key.upper()}="{params.get(key, [""])[0]}"')
PY
)"

if [[ -z "${SID:-}" || -z "${TENANTID:-}" || -z "${RESOURCETYPE:-}" || -z "${RESOURCEID:-}" || -z "${EXP:-}" || -z "${SIG:-}" ]]; then
  echo "Signed redirect URL is missing required parameters." >&2
  echo "$REDIRECT_LOCATION" >&2
  exit 1
fi

public_share_path="/shares/${SID}/public?tenantId=${TENANTID}&resourceType=${RESOURCETYPE}&resourceId=${RESOURCEID}&exp=${EXP}&sig=${SIG}"
public_share_body="$(request_json GET "$public_share_path")"
assert_status "$public_share_body" 200
jq -e --arg share_id "$OWNER_SHARE_ID" '.shareId == $share_id' "$public_share_body" >/dev/null

echo "[9/12] image upload + image content access matrix"
TMP_IMAGE="$(mktemp "${TMPDIR:-/tmp}/t23-image-XXXXXX.png")"
python3 - <<'PY' > "$TMP_IMAGE"
import base64
import sys

payload = b'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7f6S8AAAAASUVORK5CYII='
sys.stdout.buffer.write(base64.b64decode(payload))
PY

upload_image_body="$(request_multipart_file "/products/${OWNER_PRODUCT_ID}/images" "$OWNER_TOKEN" "$TMP_IMAGE")"
assert_status "$upload_image_body" 201
IMAGE_ID="$(jq -r '.image.id // empty' "$upload_image_body")"
if [[ -z "$IMAGE_ID" ]]; then
  echo "upload image returned empty image id" >&2
  cat "$upload_image_body" >&2
  exit 1
fi

for token in "$OWNER_TOKEN" "$ADMIN_TOKEN" "$EDITOR_TOKEN" "$VIEWER_TOKEN"; do
  image_status="$(request_status_only GET "/products/${OWNER_PRODUCT_ID}/images/${IMAGE_ID}/content" "$token")"
  assert_status_one_of "$image_status" 200 302
done

echo "[10/12] /admin/* denied for tenant roles"
for token in "$OWNER_TOKEN" "$ADMIN_TOKEN" "$EDITOR_TOKEN" "$VIEWER_TOKEN"; do
  admin_body="$(request_json GET /admin/tenants "" "$token")"
  assert_status "$admin_body" 403
  assert_error_code "$admin_body" FORBIDDEN
done

echo "[11/12] /admin/* super-admin positive (if provided)"
if [[ -n "$SUPER_ADMIN_BASE_TOKEN" ]]; then
  super_admin_body="$(request_json GET /admin/tenants "" "$SUPER_ADMIN_BASE_TOKEN")"
  super_admin_status="$(cat "${super_admin_body}.status")"

  if [[ "$REQUIRE_SUPER_ADMIN_PASS" -eq 1 ]]; then
    assert_status "$super_admin_body" 200
  else
    if [[ "$super_admin_status" != "200" ]]; then
      echo "WARN: super-admin positive check did not pass (HTTP ${super_admin_status})." >&2
      echo "      Check SUPER_ADMIN_ENABLED=true and SUPER_ADMIN_EMAILS includes ${SUPER_ADMIN_EMAIL}." >&2
    fi
  fi
else
  echo "SKIP: super-admin positive check (no --super-admin-email provided)."
fi

echo "[12/12] done"
echo "T23 account matrix smoke OK"
echo "- tenantId=${TENANT_ID}"
echo "- ownerProductId=${OWNER_PRODUCT_ID}"
echo "- imageId=${IMAGE_ID}"
echo "- ownerShareId=${OWNER_SHARE_ID}"
echo "- adminShare=${ADMIN_SHARE_DATA%%,*}"
echo "- editorShare=${EDITOR_SHARE_DATA%%,*}"
