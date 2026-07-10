-- Decommission the dead monthly-quota infra (#131, follow-up to #79/#130).
-- Order matters: stop the CALLER (cron) first, then drop the now-unused objects.

-- 1) Unschedule the monthly reset cron — guarded so this is safe whether or not
--    pg_cron is installed and whether or not the job exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-ai-usage-monthly') THEN
    PERFORM cron.unschedule('reset-ai-usage-monthly');
  END IF;
END $$;

-- 2) Drop the dead quota columns + index (idempotent).
DROP INDEX IF EXISTS profiles_usage_period_start_idx;
ALTER TABLE profiles
  DROP COLUMN IF EXISTS ai_scans_used,
  DROP COLUMN IF EXISTS ai_url_imports_used,
  DROP COLUMN IF EXISTS usage_period_start;
