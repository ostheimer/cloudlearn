# Supabase: AI-Usage-Reset (Cron)

Die Edge Function `reset-ai-usage` setzt monatlich die Zähler `ai_scans_used` und `ai_url_imports_used` für alle Nutzer zurück. Dafür muss ein Cron-Job eingerichtet werden.

## Voraussetzungen

- Migration `20260301100000_add_ai_usage_limits.sql` ist eingespielt (`supabase db push`).
- Edge Function `reset-ai-usage` ist deployed (`supabase functions deploy reset-ai-usage --project-ref <REF>`).

## Option A: Cron im Dashboard (empfohlen)

1. **Supabase Dashboard** öffnen: [Integrations → Cron](https://supabase.com/dashboard/project/_/integrations/cron/jobs).
2. **Create job** klicken.
3. **Supabase Edge Function** auswählen, Function: `reset-ai-usage`.
4. **Schedule:** Cron-Syntax `0 0 1 * *` (jeden 1. des Monats, 00:00 UTC) oder per Natural Language z. B. „Monthly on the 1st at midnight UTC“.
5. **Name:** z. B. `reset-ai-usage-monthly` (Name ist nachträglich nicht änderbar).
6. **Create job** bestätigen.

## Option B: Cron per SQL (pg_cron + pg_net)

Falls du den Job per SQL anlegen willst (z. B. für Reproduzierbarkeit), zuerst **Vault-Secrets** anlegen (Dashboard → SQL Editor):

```sql
-- Projekt-URL (ohne trailing slash)
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- Anon Key aus Dashboard → Settings → API
SELECT vault.create_secret('YOUR_ANON_KEY', 'anon_key');
```

Anschließend den Cron-Job anlegen (einmalig, z. B. im SQL Editor):

```sql
SELECT cron.schedule(
  'reset-ai-usage-monthly',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/reset-ai-usage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Voraussetzung: Erweiterungen `pg_cron` und `pg_net` sind im Projekt aktiv (auf gehostetem Supabase standardmäßig verfügbar).

## Manueller Test

Mit dem **Anon Key** aus dem Dashboard (Settings → API):

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/reset-ai-usage' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Erwartung: `{"success":true,"resetCount":...,"period":"YYYY-MM-01"}` (Status 200).

## Referenzen

- [Supabase: Schedule Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase: Cron Quickstart](https://supabase.com/docs/guides/cron/quickstart)
- BACKLOG: CL-MON-01 (Supabase Migration + Edge Function deployen)
