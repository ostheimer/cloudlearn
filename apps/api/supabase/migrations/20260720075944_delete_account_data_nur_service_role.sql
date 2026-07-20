-- NOTFALL-KORREKTUR (20.07., rund 40 Minuten offen).
--
-- Nach dem Nachziehen von delete_account_data war die Funktion über
-- /rest/v1/rpc/delete_account_data für `anon` und `authenticated` aufrufbar.
-- Sie ist SECURITY DEFINER und nimmt die Ziel-Kennung als Parameter: Jeder
-- mit dem öffentlichen anon-Key (der im Web-Bundle steht) hätte damit ein
-- BELIEBIGES fremdes Konto löschen können — samt Decks, Karten, Verlauf und
-- Punkten, alles per ON DELETE CASCADE.
--
-- Ursache: `revoke all on function ... from public` entfernt nur das Recht
-- der PUBLIC-Pseudorolle. Supabase vergibt EXECUTE auf Funktionen im Schema
-- public ZUSÄTZLICH ausdrücklich an anon und authenticated; solche Grants
-- überleben ein revoke gegen PUBLIC. Die Quell-Migration von 04.04. hatte
-- nur die public-Zeile — der Fehler kam also mit, nicht dazu.
--
-- Aufgefallen beim Linter-Lauf NACH dem Anwenden (0028/0029). Ohne diesen
-- Nachlauf wäre es unbemerkt geblieben: Der Fehler äußert sich in nichts,
-- solange ihn niemand ausnutzt.
--
-- Nachgemessen im offenen Fenster: 0 Grabsteine, 6 Profile, 92 Decks,
-- 376 Karten — unverändert. Es wurde nichts gelöscht.
--
-- Diese Datei bleibt nötig, obwohl die Quell-Migrationen inzwischen korrigiert
-- sind: Prod hat die fehlerhafte Fassung bereits ausgeführt und führt sie
-- nicht erneut aus.

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'delete_account_data'
  ) then
    revoke execute on function public.delete_account_data(uuid, text) from public;
    revoke execute on function public.delete_account_data(uuid, text) from anon;
    revoke execute on function public.delete_account_data(uuid, text) from authenticated;
    grant  execute on function public.delete_account_data(uuid, text) to service_role;
  end if;
end $$;
