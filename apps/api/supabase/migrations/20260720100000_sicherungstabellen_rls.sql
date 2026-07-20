-- Die drei Sicherungstabellen aus den Aufräum-Aktionen vom 13./14.07. lagen
-- ohne RLS im Schema `public`. Alles dort ist über PostgREST erreichbar, und
-- der anon-Key steckt öffentlich im Web-Bundle — sie waren damit von außen
-- lesbar, ohne jede Anmeldung. Von außen nachgewiesen (HTTP 200 mit echten
-- Deck- und Karteninhalten), vom Supabase-Linter als ERROR
-- `rls_disabled_in_public` gemeldet.
--
-- Dritter Fall dieser Art: #135 (lp_balance selbst setzbar) und #356/#359
-- (private Decks ohne Login lesbar). Der gemeinsame Nenner ist nicht ein
-- vergessenes Detail, sondern dass eine neue Tabelle standardmäßig offen ist,
-- solange niemand aktiv zusperrt.
--
-- Die Tabellen BLEIBEN erhalten — Lara hat sie am 13.07. bewusst behalten
-- ([[prod-backup-tables]]), und behalten heißt nicht ungeschützt. Es wird nur
-- die Tür zugesperrt, kein Inhalt angefasst.
--
-- Bewusst ohne Policies: An diese Tabellen soll überhaupt niemand über die
-- API — sie sind reine Notfall-Kopien. `service_role` (Admin-Client, SQL-
-- Editor, MCP) umgeht RLS und kommt weiter ungehindert dran, falls jemals
-- etwas daraus zurückgeholt werden muss. Der Linter meldet das anschließend
-- als INFO "RLS Enabled No Policy"; genau das ist hier die Absicht.
--
-- `if exists`, weil Sicherungstabellen ihrer Natur nach irgendwann gelöscht
-- werden: Die Migration muss auch dann noch durchlaufen (eine davon,
-- cards_cleanterm_backup_20260710, ist bereits verschwunden).

do $$
declare
  t text;
begin
  foreach t in array array[
    'decks_dedupe_backup_20260713',
    'cleanup_cards_backup_20260714',
    'cleanup_decks_backup_20260714',
    'cards_cleanterm_backup_20260710'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
