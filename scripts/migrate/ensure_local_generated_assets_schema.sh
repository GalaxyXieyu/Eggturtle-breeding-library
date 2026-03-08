#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_DATABASE_URL="postgres://eggturtle:eggturtle@localhost:30001/eggturtle"
DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"
SQL_FILE="$ROOT_DIR/scripts/migrate/local_generated_assets_repair.sql"

cd "$ROOT_DIR/apps/api"
DATABASE_URL="$DATABASE_URL" pnpm exec prisma db execute --schema prisma/schema.prisma --file "$SQL_FILE"
echo "Local generated-assets schema repair applied: $DATABASE_URL"
