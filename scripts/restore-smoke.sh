#!/usr/bin/env bash
set -euo pipefail

MIGRATION_FILE="apps/api/supabase/migrations/20260209230000_init.sql"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "[restore-smoke] Migration file exists."
echo "[restore-smoke] Simulated restore check passed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")."
