#!/usr/bin/env bash
set -euo pipefail

MIGRATION_FILE="apps/api/supabase/migrations/20260209230000_init.sql"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "[restore-smoke] Migration file exists: $MIGRATION_FILE"
echo "[restore-smoke] ⚠️  SIMULATION ONLY — this does NOT perform a real database restore."
echo "[restore-smoke]     It only checks that the init migration file is present."
echo "[restore-smoke]     A real restore test (Supabase backup, Vercel rollback, RevenueCat"
echo "[restore-smoke]     webhooks, R2 signed URLs, AI fallback) must be run manually per"
echo "[restore-smoke]     docs/runbooks/restore-test.md. Do NOT treat this as a real restore gate."
