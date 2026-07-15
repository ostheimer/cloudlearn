-- Einladungs-/Referral-Codes: Backfill + Automatik für neue Konten.
--
-- Bisher wurde ein referral_code nur EINMALIG per Migration
-- 20260312150000_add_lp_system.sql für die damals existierenden Profile
-- erzeugt. Neue Konten (z. B. ab Juli 2026) bekamen keinen Code, weil kein
-- Default/Trigger existierte -> /api/v1/referral/info lieferte null und die
-- „Freunde einladen"-UI hing bei „wird geladen …" ohne etwas zum Teilen.
--
-- Bereits am 2026-07-15 direkt auf Prod angewendet (MCP apply_migration); diese
-- Datei hält das Repo im Gleichstand (siehe Gedächtnis: migration-deploy-process).

-- 1) Jedem Profil ohne Code nachträglich einen erzeugen.
update profiles
set referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code is null;

-- 2) Neue Profile bekommen automatisch einen Code (gen_random_uuid ist volatile,
--    wird also pro INSERT ausgewertet; die UNIQUE-Constraint bleibt gewahrt).
alter table profiles
  alter column referral_code set default upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
