#!/usr/bin/env bash
# Sets up the monthly cron job for reset-ai-usage via CLI:
# 1. Fetches anon key from Supabase CLI
# 2. Creates Vault secrets (project_url, anon_key) and schedules the cron via psql
#
# Prerequisites: supabase linked, pg_cron + pg_net enabled in Dashboard, psql installed.
# Required env: SUPABASE_DB_URL (Postgres connection string from Dashboard → Settings → Database)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$API_ROOT"

# Load DB URL from .env.local if present
if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-yektpwhycxusblnueplm}"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL is required (Postgres connection string from Dashboard → Settings → Database)." >&2
  exit 1
fi

echo "Fetching anon key for project $PROJECT_REF..."
ANON_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null | jq -r '.[] | select(.name=="anon") | .api_key')
if [[ -z "$ANON_KEY" || "$ANON_KEY" == "null" ]]; then
  echo "Error: Could not get anon key. Run 'supabase login' and ensure the project is accessible." >&2
  exit 1
fi

# Escape single quotes for use in SQL: ' -> ''
ANON_KEY_ESC="${ANON_KEY//\'/\'\'}"

echo "Creating Vault secrets and scheduling cron (reset-ai-usage-monthly, 0 0 1 * *)..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<SQL
-- Vault secrets for cron (idempotent: skip if name exists via exception)
DO \$\$
BEGIN
  PERFORM vault.create_secret('$PROJECT_URL', 'project_url');
EXCEPTION WHEN unique_violation THEN NULL;
END \$\$;
DO \$\$
BEGIN
  PERFORM vault.create_secret('$ANON_KEY_ESC', 'anon_key');
EXCEPTION WHEN unique_violation THEN NULL;
END \$\$;

-- Schedule Edge Function on the 1st of each month at 00:00 UTC (same name = overwrite)
SELECT cron.schedule(
  'reset-ai-usage-monthly',
  '0 0 1 * *',
  \$cron\$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/reset-ai-usage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) AS request_id;
  \$cron\$
);
SQL

echo "Done. Cron job 'reset-ai-usage-monthly' is scheduled (0 0 1 * *). Verify in Dashboard → Integrations → Cron → Jobs."
