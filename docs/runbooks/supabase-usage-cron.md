# Supabase: AI-Usage-Reset (Cron)

Die Edge Function `reset-ai-usage` setzt monatlich die Zähler `ai_scans_used` und `ai_url_imports_used` für alle Nutzer zurück. Dafür muss ein Cron-Job eingerichtet werden.

## Voraussetzungen

- Migration `20260301100000_add_ai_usage_limits.sql` ist eingespielt (`supabase db push`).
- Edge Function `reset-ai-usage` ist deployed (`supabase functions deploy reset-ai-usage --project-ref <REF>`).
- **pg_cron** und **pg_net**: Im Dashboard unter Database → Extensions aktivieren (für Option B/C).

---

## Option A: Cron im Dashboard (ohne Vault)

1. **Supabase Dashboard** öffnen: [Integrations → Cron](https://supabase.com/dashboard/project/_/integrations/cron/jobs).
2. **Create job** klicken.
3. **Supabase Edge Function** auswählen, Function: `reset-ai-usage`.
4. **Schedule:** Cron-Syntax `0 0 1 * *` (jeden 1. des Monats, 00:00 UTC) oder Natural Language z. B. „Monthly on the 1st at midnight UTC“.
5. **Name:** z. B. `reset-ai-usage-monthly` (Name ist nachträglich nicht änderbar).
6. **Create job** bestätigen.

---

## Option B: Cron per CLI (Migration nach Vault-Setup)

Einmalig **Vault-Secrets** anlegen (Dashboard → SQL Editor):

```sql
-- Projekt-URL (ohne trailing slash)
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- Anon Key aus Dashboard → Settings → API
SELECT vault.create_secret('YOUR_ANON_KEY', 'anon_key');
```

Anschließend im Projekt von `apps/api` aus:

```bash
supabase link --project-ref YOUR_PROJECT_REF   # falls noch nicht verlinkt
supabase db push
```

Die Migration `20260312120000_schedule_reset_ai_usage_cron.sql` legt den Job nur an, wenn beide Vault-Secrets existieren; sonst passiert nichts (kein Fehler).

---

## Option C: Cron per SQL (manuell im SQL Editor)

Wie Option B: Zuerst Vault-Secrets anlegen, dann im SQL Editor ausführen:

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

---

## Option D: Supabase MCP (Cursor)

Wenn du das [Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp) in Cursor eingerichtet hast, kannst du den Cron-Job per AI ausführen lassen:

1. Vault-Secrets wie unter Option B anlegen.
2. Den Assistenten bitten: *„Führe das SQL aus docs/runbooks/supabase-usage-cron.md (Option C) über Supabase MCP execute_sql aus.“*

Das MCP bietet u. a. `execute_sql` und eignet sich für einmalige oder wiederholbare Setup-Schritte.

## Manueller Test

Mit dem **Anon Key** aus dem Dashboard (Settings → API):

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/reset-ai-usage' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Erwartung: `{"success":true,"resetCount":...,"period":"YYYY-MM-01"}` (Status 200).

## Erweiterungen prüfen

Für Option B/C: **pg_cron** (Integrations → Cron → Enable) und **pg_net** (Database → Extensions → pg_net aktivieren) müssen im Projekt aktiv sein.

## Referenzen

- [Supabase: Schedule Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase: Cron Quickstart](https://supabase.com/docs/guides/cron/quickstart)
- [Supabase MCP (Cursor)](https://supabase.com/docs/guides/getting-started/mcp)
- BACKLOG: CL-MON-01 (Supabase Migration + Edge Function deployen)
