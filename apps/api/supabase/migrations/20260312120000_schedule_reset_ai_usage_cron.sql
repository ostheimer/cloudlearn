-- Schedules the Edge Function "reset-ai-usage" to run on the 1st of each month at 00:00 UTC.
-- Requires: pg_cron and pg_net enabled (Dashboard → Database → Extensions).
-- Requires: Vault secrets "project_url" and "anon_key" (create once in SQL Editor, see docs/runbooks/supabase-usage-cron.md).
-- If Vault secrets are missing, this migration does nothing (no error).

DO $$
BEGIN
  IF (SELECT count(*) FROM vault.decrypted_secrets WHERE name IN ('project_url', 'anon_key')) = 2 THEN
    PERFORM cron.schedule(
      'reset-ai-usage-monthly',
      '0 0 1 * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/reset-ai-usage',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      ) AS request_id;
      $cron$
    );
  END IF;
END $$;
