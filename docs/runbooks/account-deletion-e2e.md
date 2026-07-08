# Account Deletion E2E

Stand: 2026-05-02

## Ziel

Dieses Runbook beschreibt den produktionsnahen Test für die selbstständige Konto-Löschung in `clearn`.
Der Test gilt erst als bestanden, wenn Code, Supabase-Migration und echter App-Flow zusammen geprüft wurden.

## Produktvertrag

- Die Löschung ist sofortig und endgültig.
- App-Daten werden über das Profil gelöscht; Lerninhalte, Kurse, Ordner, Reviews, Scans, LP-Logs, Friend-Connections und Push-Tokens hängen per `ON DELETE CASCADE` am Profil.
- Eine Tombstone-Zeile in `deleted_accounts` verhindert, dass eine alte Auth-Session das Profil erneut anlegt.
- Ein Apple- oder Google-Abo wird nicht automatisch beendet. Die App weist vor der Löschung darauf hin, dass Abos separat im Store verwaltet werden müssen.

## Relevante Dateien

- API-Route: [apps/api/app/api/v1/account/route.ts](/apps/api/app/api/v1/account/route.ts)
- Service: [apps/api/src/services/accountDeletionService.ts](/apps/api/src/services/accountDeletionService.ts)
- Supabase-Migration: [apps/api/supabase/migrations/20260404120000_add_deleted_accounts.sql](/apps/api/supabase/migrations/20260404120000_add_deleted_accounts.sql)
- Mobile-UI: [apps/mobile/app/(tabs)/profile.tsx](/apps/mobile/app/(tabs)/profile.tsx)

## Repo-Verifikation

Im Repository ausführen:

```bash
pnpm --filter @clearn/api test -- accountDeletion migrations
pnpm --filter @clearn/mobile typecheck
```

Erwartung:

- Unauthentifizierte Requests erhalten `401`.
- Erfolgreiche Löschung liefert `200` und `{ deleted: true }`.
- Wenn App-Daten gelöscht sind, aber die technische Auth-Löschung offen bleibt, liefert die API `202` mit `warning`.
- Migrationstest bestätigt Tombstone, Service-Role-RPC und kaskadierende Profil-Referenzen.

## Supabase-Rollout

Vor dem echten E2E-Test muss die Migration auf der Ziel-Datenbank angewendet sein:

1. Sicherstellen, dass `SUPABASE_SERVICE_ROLE_KEY` nur serverseitig in Vercel gesetzt ist.
2. Migration `20260404120000_add_deleted_accounts.sql` auf die Ziel-Datenbank ausrollen.
3. In Supabase SQL Editor prüfen:

```sql
select to_regclass('public.deleted_accounts') as deleted_accounts_table;
select proname from pg_proc where proname = 'delete_account_data';
```

Erwartung:

- `deleted_accounts_table` ist `deleted_accounts`.
- `delete_account_data` existiert.

## Manueller E2E-Test

Mit einem dedizierten Testkonto durchführen, nicht mit einem produktiven Hauptkonto.

1. Neues Testkonto in der App registrieren.
2. Mindestens ein Deck, eine Karte, einen Review, einen Scan und optional einen LP-Eintrag erzeugen.
3. In Supabase die User-ID des Testkontos notieren.
4. In der App Profil → Konto löschen öffnen.
5. Beide Warn-Dialoge prüfen:
   - endgültige Datenlöschung
   - Abo muss separat im Store verwaltet werden
6. Löschung bestätigen.
7. Erwartung in der App:
   - Erfolgsmeldung erscheint
   - Nutzer wird abgemeldet
   - erneuter API-Zugriff mit alter Session ist nicht möglich
8. Erwartung in Supabase:

```sql
select * from deleted_accounts where user_id = '<USER_ID>';
select * from profiles where id = '<USER_ID>';
select * from decks where user_id = '<USER_ID>';
select * from cards where user_id = '<USER_ID>';
select * from review_logs where user_id = '<USER_ID>';
select * from scans where user_id = '<USER_ID>';
```

Alle Tabellen außer `deleted_accounts` müssen leer sein.

## Abnahmekriterium

Der P0-Punkt ist erst abgeschlossen, wenn:

- die Migration in der Ziel-Datenbank angewendet wurde,
- der App-Flow mit einem echten Testkonto bestanden ist,
- die SQL-Prüfung nach der Löschung keine App-Daten mehr findet,
- das Ergebnis im Release-Log oder in diesem Runbook mit Datum dokumentiert wurde.
