#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

RUN_ID=""
SOURCE_API=""
SOURCE_USER=""
SOURCE_PASS=""
TARGET_DB_URL=""
TENANT_SLUG="siri"
TENANT_NAME="Siri"
ADMIN_EMAIL="galaxyxieyu@account.eggturtle.local"
TARGET_MINIO_ENDPOINT=""
TARGET_MINIO_AK=""
TARGET_MINIO_SK=""
TARGET_MINIO_BUCKET="eggturtles"
SOURCE_MINIO_ENDPOINT="38.76.197.25:34124"
SOURCE_MINIO_AK="eggturtleadmin"
SOURCE_MINIO_SK="06e182e9d85cc4efde1db4049352b45b"
SOURCE_MINIO_BUCKET="eggturtles"
IMAGE_CONCURRENCY="3"
IMAGE_TIMEOUT_MS="15000"
MAX_IMAGE_FAILURES="0"
IMPORT_RETRIES="1"
TAURUS_SSH_HOST="Taurus"
TAURUS_PG_CONTAINER="shared-postgres"
ALIYUN_SSH_HOST="egg-minio"
ALIYUN_MINIO_CONTAINER="minio"
CONFIRM="false"

function usage() {
  cat <<'USAGE'
Usage:
  scripts/migrate/run_migration_prod.sh \
    --run-id <id> \
    --source-api <url> \
    --source-user <username> \
    --source-pass <password> \
    --target-db-url <postgres-url> \
    --target-minio-endpoint <endpoint> \
    --target-minio-ak <access-key> \
    --target-minio-sk <secret-key> \
    [--tenant-slug siri] \
    [--tenant-name Siri] \
    [--confirm]

Required:
  --run-id
  --source-api
  --source-user
  --source-pass
  --target-db-url
  --target-minio-endpoint
  --target-minio-ak
  --target-minio-sk

Options:
  --tenant-slug <slug>                 Default: siri
  --tenant-name <name>                 Default: Siri
  --admin-email <email>                Default: galaxyxieyu@account.eggturtle.local
  --target-minio-bucket <bucket>       Default: eggturtles
  --source-minio-endpoint <endpoint>   Default: 38.76.197.25:34124
  --source-minio-ak <access-key>       Default: eggturtleadmin
  --source-minio-sk <secret-key>       Default: (known Taurus shared-minio key)
  --source-minio-bucket <bucket>       Default: eggturtles
  --image-concurrency <n>              Default: 3
  --image-timeout-ms <n>               Default: 15000
  --max-image-failures <n>             Default: 0
  --taurus-host <ssh-host>             Default: Taurus
  --taurus-pg-container <name>         Default: shared-postgres
  --aliyun-host <ssh-host>             Default: egg-minio
  --aliyun-minio-container <name>      Default: minio
  --confirm                            Execute write actions (DB write + mirror write)
  -h, --help

Behavior:
  - Default mode is DRY-RUN for remote write steps.
  - Export step always writes local artifact files for reproducible validation.
  - In DRY-RUN, importer runs without --confirm and MinIO mirror uses --dry-run.
USAGE
}

function log() {
  printf '[run_migration_prod] %s\n' "$*"
}

function fail() {
  printf '[run_migration_prod] ERROR: %s\n' "$*" >&2
  exit 1
}

function require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

function require_value() {
  local arg_name="$1"
  local arg_value="${2:-}"
  [[ -n "$arg_value" ]] || fail "$arg_name requires a value"
}

function parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --run-id)
        RUN_ID="${2:-}"
        shift 2
        ;;
      --source-api)
        SOURCE_API="${2:-}"
        shift 2
        ;;
      --source-user)
        SOURCE_USER="${2:-}"
        shift 2
        ;;
      --source-pass)
        SOURCE_PASS="${2:-}"
        shift 2
        ;;
      --target-db-url)
        TARGET_DB_URL="${2:-}"
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
      --admin-email)
        ADMIN_EMAIL="${2:-}"
        shift 2
        ;;
      --target-minio-endpoint)
        TARGET_MINIO_ENDPOINT="${2:-}"
        shift 2
        ;;
      --target-minio-ak)
        TARGET_MINIO_AK="${2:-}"
        shift 2
        ;;
      --target-minio-sk)
        TARGET_MINIO_SK="${2:-}"
        shift 2
        ;;
      --target-minio-bucket)
        TARGET_MINIO_BUCKET="${2:-}"
        shift 2
        ;;
      --source-minio-endpoint)
        SOURCE_MINIO_ENDPOINT="${2:-}"
        shift 2
        ;;
      --source-minio-ak)
        SOURCE_MINIO_AK="${2:-}"
        shift 2
        ;;
      --source-minio-sk)
        SOURCE_MINIO_SK="${2:-}"
        shift 2
        ;;
      --source-minio-bucket)
        SOURCE_MINIO_BUCKET="${2:-}"
        shift 2
        ;;
      --image-concurrency)
        IMAGE_CONCURRENCY="${2:-}"
        shift 2
        ;;
      --image-timeout-ms)
        IMAGE_TIMEOUT_MS="${2:-}"
        shift 2
        ;;
      --max-image-failures)
        MAX_IMAGE_FAILURES="${2:-}"
        shift 2
        ;;
      --import-retries)
        IMPORT_RETRIES="${2:-}"
        shift 2
        ;;
      --taurus-host)
        TAURUS_SSH_HOST="${2:-}"
        shift 2
        ;;
      --taurus-pg-container)
        TAURUS_PG_CONTAINER="${2:-}"
        shift 2
        ;;
      --aliyun-host)
        ALIYUN_SSH_HOST="${2:-}"
        shift 2
        ;;
      --aliyun-minio-container)
        ALIYUN_MINIO_CONTAINER="${2:-}"
        shift 2
        ;;
      --confirm)
        CONFIRM="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done

  require_value --run-id "$RUN_ID"
  require_value --source-api "$SOURCE_API"
  require_value --source-user "$SOURCE_USER"
  require_value --source-pass "$SOURCE_PASS"
  require_value --target-db-url "$TARGET_DB_URL"
  require_value --target-minio-endpoint "$TARGET_MINIO_ENDPOINT"
  require_value --target-minio-ak "$TARGET_MINIO_AK"
  require_value --target-minio-sk "$TARGET_MINIO_SK"
  [[ "$IMPORT_RETRIES" =~ ^[0-9]+$ ]] || fail "--import-retries must be a non-negative integer"
}

function parse_db_name_from_url() {
  python3 - "$TARGET_DB_URL" <<'PY'
import sys
from urllib.parse import urlparse
url = sys.argv[1].strip()
parsed = urlparse(url)
path = (parsed.path or '').strip('/')
if not path:
    raise SystemExit('')
print(path)
PY
}

function parse_db_user_from_url() {
  python3 - "$TARGET_DB_URL" <<'PY'
import sys
from urllib.parse import urlparse
url = sys.argv[1].strip()
parsed = urlparse(url)
print((parsed.username or '').strip())
PY
}

function parse_db_password_from_url() {
  python3 - "$TARGET_DB_URL" <<'PY'
import sys
from urllib.parse import urlparse, unquote
url = sys.argv[1].strip()
parsed = urlparse(url)
print(unquote(parsed.password or '').strip())
PY
}

function normalize_endpoint() {
  python3 - "$1" <<'PY'
import sys
endpoint = sys.argv[1].strip()
if not endpoint:
    raise SystemExit('')
if endpoint.startswith('http://') or endpoint.startswith('https://'):
    print(endpoint.rstrip('/'))
else:
    print(('http://' + endpoint).rstrip('/'))
PY
}

function build_mc_host() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
from urllib.parse import quote, urlparse
endpoint, access_key, secret_key = sys.argv[1], sys.argv[2], sys.argv[3]
if not endpoint.startswith(('http://', 'https://')):
    endpoint = 'http://' + endpoint
parsed = urlparse(endpoint)
scheme = parsed.scheme or 'http'
netloc = parsed.netloc or parsed.path
path = parsed.path if parsed.netloc else ''
if path == '/':
    path = ''
ak = quote(access_key, safe='')
sk = quote(secret_key, safe='')
print(f"{scheme}://{ak}:{sk}@{netloc}{path}")
PY
}

function run_taurus_psql() {
  local sql="$1"
  ssh "$TAURUS_SSH_HOST" \
    "docker exec -e PGPASSWORD='${DB_PASS}' -i ${TAURUS_PG_CONTAINER} psql -h 127.0.0.1 -p 5432 -U '${DB_USER}' -d '${DB_NAME}' -v ON_ERROR_STOP=1 -AtF \$'\\t'" \
    <<<"$sql"
}

function taurus_precheck() {
  ssh "$TAURUS_SSH_HOST" "docker ps --format '{{.Names}}' | grep -Fx '${TAURUS_PG_CONTAINER}' >/dev/null" \
    || fail "Postgres container '${TAURUS_PG_CONTAINER}' not found on ${TAURUS_SSH_HOST}"
}

function aliyun_precheck() {
  ssh "$ALIYUN_SSH_HOST" "podman ps --format '{{.Names}}' | grep -Fx '${ALIYUN_MINIO_CONTAINER}' >/dev/null" \
    || fail "MinIO container '${ALIYUN_MINIO_CONTAINER}' not found on ${ALIYUN_SSH_HOST}"
}

function snapshot_db_backup() {
  local backup_file="$1"
  log "Creating DB snapshot backup: ${backup_file}"
  ssh "$TAURUS_SSH_HOST" \
    "docker exec -e PGPASSWORD='${DB_PASS}' -i ${TAURUS_PG_CONTAINER} pg_dump -h 127.0.0.1 -p 5432 -U '${DB_USER}' -d '${DB_NAME}' -Fc" \
    > "$backup_file"
}

function snapshot_baseline_counts() {
  local output_file="$1"
  log "Recording pre-import baseline counts"
  run_taurus_psql "
WITH target_tenant AS (
  SELECT id, slug
  FROM tenants
  WHERE slug = '${TENANT_SLUG}'
  LIMIT 1
)
SELECT
  tt.id,
  tt.slug,
  (SELECT COUNT(*) FROM series s WHERE s.tenant_id = tt.id),
  (SELECT COUNT(*) FROM products p WHERE p.tenant_id = tt.id),
  (SELECT COUNT(*) FROM product_events e WHERE e.tenant_id = tt.id),
  (SELECT COUNT(*) FROM product_images i WHERE i.tenant_id = tt.id),
  (SELECT COUNT(*) FROM featured_products f WHERE f.tenant_id = tt.id),
  (SELECT COUNT(*) FROM public_shares ps WHERE ps.tenant_id = tt.id),
  (SELECT COUNT(*) FROM product_couple_photos cp WHERE cp.tenant_id = tt.id),
  (SELECT COUNT(*) FROM product_images i WHERE i.tenant_id = tt.id AND i.key LIKE tt.id || '/%'),
  (SELECT COUNT(*) FROM product_couple_photos cp WHERE cp.tenant_id = tt.id AND cp.image_key LIKE tt.id || '/%')
FROM target_tenant tt;
" > "$output_file"
}

function run_export() {
  local output_root="$1"
  log "Exporting from legacy API (${SOURCE_API})"

  pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_prod_api_export.ts \
    --api-base-url "$SOURCE_API" \
    --username "$SOURCE_USER" \
    --password "$SOURCE_PASS" \
    --output-root "$output_root" \
    --run-id "$RUN_ID" \
    --confirm
}

function run_minio_mirror() {
  local phase="$1"
  local mirror_mode="$2"
  local object_count_file="$3"

  log "Running MinIO mirror (${phase}, ${mirror_mode})"

  ssh "$ALIYUN_SSH_HOST" "podman exec -i ${ALIYUN_MINIO_CONTAINER} sh" <<__REMOTE__ | tee "$object_count_file"
set -eu
export MC_HOST_src='${MC_SRC_HOST}'
export MC_HOST_dst='${MC_DST_HOST}'

if [ '${mirror_mode}' = 'write' ]; then
  mc mb --ignore-existing dst/${TARGET_MINIO_BUCKET}
  mc mirror --overwrite src/${SOURCE_MINIO_BUCKET} dst/${TARGET_MINIO_BUCKET}
else
  if mc ls dst/${TARGET_MINIO_BUCKET} >/dev/null 2>&1; then
    mc mirror --dry-run --overwrite src/${SOURCE_MINIO_BUCKET} dst/${TARGET_MINIO_BUCKET}
  else
    echo 'target_bucket_missing	1'
    echo 'skip_mirror	1'
  fi
fi

printf 'source_object_count\t'
mc ls --recursive src/${SOURCE_MINIO_BUCKET} 2>/dev/null | wc -l
printf 'target_object_count\t'
mc ls --recursive dst/${TARGET_MINIO_BUCKET} 2>/dev/null | wc -l
echo 'source_du'
mc du --depth 2 src/${SOURCE_MINIO_BUCKET} || true
echo 'target_du'
mc du --depth 2 dst/${TARGET_MINIO_BUCKET} || true
__REMOTE__
}

function run_import() {
  local export_json="$1"
  local report_dir="$2"

  log "Running target tenant sync (tenant=${TENANT_SLUG})"

  local import_args=(
    pnpm --filter @eggturtle/api exec ts-node --project tsconfig.json ../../scripts/migrate/turtle_album_v2_sync_tenant.ts
    --input "$export_json"
    --env prod
    --confirm-prod
    --tenant-slug "$TENANT_SLUG"
    --tenant-name "$TENANT_NAME"
    --admin-email "$ADMIN_EMAIL"
    --legacy-image-base-url "$SOURCE_API"
    --report-dir "$report_dir"
    --import-image-binaries
    --image-concurrency "$IMAGE_CONCURRENCY"
    --image-timeout-ms "$IMAGE_TIMEOUT_MS"
    --max-image-failures "$MAX_IMAGE_FAILURES"
  )

  if [[ "$CONFIRM" == "true" ]]; then
    import_args+=(--confirm)
  fi

  local attempts
  attempts=$((IMPORT_RETRIES + 1))
  local attempt
  attempt=1

  while [[ "$attempt" -le "$attempts" ]]; do
    if STORAGE_PROVIDER=s3 \
      DATABASE_URL="$TARGET_DB_URL" \
      S3_ENDPOINT="$TARGET_MINIO_ENDPOINT_NORM" \
      S3_REGION=us-east-1 \
      S3_BUCKET="$TARGET_MINIO_BUCKET" \
      S3_ACCESS_KEY_ID="$TARGET_MINIO_AK" \
      S3_SECRET_ACCESS_KEY="$TARGET_MINIO_SK" \
      S3_FORCE_PATH_STYLE=true \
      "${import_args[@]}"; then
      return 0
    fi

    local exit_code=$?
    if [[ "$attempt" -ge "$attempts" ]]; then
      return "$exit_code"
    fi

    log "Import attempt ${attempt}/${attempts} failed (exit=${exit_code}), retrying in 5s..."
    sleep 5
    attempt=$((attempt + 1))
  done
}

function run_verification() {
  local export_json="$1"
  local verify_json="$2"
  local verify_md="$3"

  log "Running post-import verification"

  local verify_args=(
    node scripts/migrate/verify_turtle_album_alignment.mjs
    --export-json "$export_json"
    --tenant-slug "$TENANT_SLUG"
    --output-json "$verify_json"
    --output-md "$verify_md"
  )

  if [[ "$CONFIRM" == "true" ]]; then
    verify_args+=(--fail-on-mismatch)
  fi

  DATABASE_URL="$TARGET_DB_URL" "${verify_args[@]}"
}

function main() {
  parse_args "$@"

  require_cmd pnpm
  require_cmd python3
  require_cmd jq
  require_cmd ssh
  require_cmd node

  DB_NAME="$(parse_db_name_from_url)"
  DB_USER="$(parse_db_user_from_url)"
  DB_PASS="$(parse_db_password_from_url)"
  [[ -n "$DB_NAME" ]] || fail "Failed to parse database name from --target-db-url"
  [[ -n "$DB_USER" ]] || fail "Failed to parse database username from --target-db-url"

  SOURCE_API="$(normalize_endpoint "$SOURCE_API")"
  TARGET_MINIO_ENDPOINT_NORM="$(normalize_endpoint "$TARGET_MINIO_ENDPOINT")"
  SOURCE_MINIO_ENDPOINT_NORM="$(normalize_endpoint "$SOURCE_MINIO_ENDPOINT")"

  MC_SRC_HOST="$(build_mc_host "$SOURCE_MINIO_ENDPOINT_NORM" "$SOURCE_MINIO_AK" "$SOURCE_MINIO_SK")"
  MC_DST_HOST="$(build_mc_host "$TARGET_MINIO_ENDPOINT_NORM" "$TARGET_MINIO_AK" "$TARGET_MINIO_SK")"

  OUTPUT_ROOT="$ROOT_DIR/out/migrate/turtle_album_prod"
  RUN_DIR="$OUTPUT_ROOT/$RUN_ID"
  SNAPSHOT_DIR="$RUN_DIR/snapshots"
  IMPORT_REPORT_DIR="$RUN_DIR/import-report"
  MIRROR_DIR="$RUN_DIR/minio-mirror"
  VERIFY_JSON="$RUN_DIR/verify/verification.json"
  VERIFY_MD="$RUN_DIR/verify/verification.md"
  EXPORT_JSON="$RUN_DIR/export.json"
  SUMMARY_JSON="$RUN_DIR/summary.json"
  BACKUP_FILE="$SNAPSHOT_DIR/${DB_NAME}-before.dump"
  BASELINE_FILE="$SNAPSHOT_DIR/baseline-before.tsv"
  BASELINE_MIRROR_FILE="$MIRROR_DIR/baseline-mirror.txt"
  FINAL_MIRROR_FILE="$MIRROR_DIR/final-mirror.txt"

  mkdir -p "$RUN_DIR" "$SNAPSHOT_DIR" "$IMPORT_REPORT_DIR" "$MIRROR_DIR" "$(dirname "$VERIFY_JSON")"

  log "Plan"
  log "- run-id: $RUN_ID"
  log "- mode: $([[ "$CONFIRM" == "true" ]] && echo WRITE || echo DRY-RUN)"
  log "- source API: $SOURCE_API"
  log "- target tenant: ${TENANT_SLUG} (${TENANT_NAME})"
  log "- admin email: $ADMIN_EMAIL"
  log "- target db: ${DB_NAME} via ${TARGET_DB_URL}"
  log "- source MinIO: ${SOURCE_MINIO_ENDPOINT_NORM}/${SOURCE_MINIO_BUCKET}"
  log "- target MinIO: ${TARGET_MINIO_ENDPOINT_NORM}/${TARGET_MINIO_BUCKET}"

  taurus_precheck
  aliyun_precheck

  if [[ "$CONFIRM" == "true" ]]; then
    log "Confirm mode: maintenance window is assumed to be ON before import/final mirror."
  else
    log "Dry-run mode: no remote write actions will be executed."
  fi

  if [[ "$CONFIRM" == "true" ]]; then
    snapshot_db_backup "$BACKUP_FILE"
  fi

  snapshot_baseline_counts "$BASELINE_FILE"
  run_export "$OUTPUT_ROOT"

  [[ -f "$EXPORT_JSON" ]] || fail "Missing export file: $EXPORT_JSON"
  [[ -f "$SUMMARY_JSON" ]] || fail "Missing summary file: $SUMMARY_JSON"

  if [[ "$CONFIRM" == "true" ]]; then
    run_minio_mirror "baseline" "write" "$BASELINE_MIRROR_FILE"
  else
    run_minio_mirror "baseline" "dry-run" "$BASELINE_MIRROR_FILE"
  fi

  run_import "$EXPORT_JSON" "$IMPORT_REPORT_DIR"

  if [[ "$CONFIRM" == "true" ]]; then
    run_minio_mirror "final" "write" "$FINAL_MIRROR_FILE"
  else
    run_minio_mirror "final" "dry-run" "$FINAL_MIRROR_FILE"
  fi

  run_verification "$EXPORT_JSON" "$VERIFY_JSON" "$VERIFY_MD"

  log "Completed"
  log "- run dir: $RUN_DIR"
  log "- export: $EXPORT_JSON"
  log "- verify json: $VERIFY_JSON"
  log "- verify md: $VERIFY_MD"
  if [[ "$CONFIRM" == "true" ]]; then
    log "- rollback DB snapshot: $BACKUP_FILE"
  fi
}

main "$@"
