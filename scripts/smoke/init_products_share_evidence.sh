#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-$(date +%Y%m%d-%H%M%S)}"
BASE_DIR="out/evidence/products-share-smoke/${RUN_ID}"

mkdir -p "${BASE_DIR}/screenshots" "${BASE_DIR}/network" "${BASE_DIR}/console" "${BASE_DIR}/logs"

cat >"${BASE_DIR}/screenshots/README.txt" <<'EOF'
Expected screenshot names:
- S01-products-page-ready.png
- S02-product-created.png
- S03-product-edit-updated-fields.png
- S04-upload-image-1.png
- S05-upload-image-2.png
- S06-images-reordered.png
- S07-cover-image-set.png
- S08-product-save-success.png
- S09-share-token-generated.png
- S10-open-share-entry.png
- S11-public-share-page.png
- S12-public-share-readonly.png
EOF

cat >"${BASE_DIR}/logs/run.meta" <<EOF
run_id=${RUN_ID}
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
commit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
EOF

echo "Created evidence directory: ${BASE_DIR}"
echo "Next: save screenshots under ${BASE_DIR}/screenshots"
