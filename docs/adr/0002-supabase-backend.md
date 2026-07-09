# ADR 0002: Supabase als Backend (Postgres, Auth, RLS)

- Status: Accepted
- Datum: 2026-07-09

## Kontext

Ein kleines Team braucht Datenhaltung, Authentifizierung, Dateiablage und eine Sicherheitsgrenze, ohne mehrere Dienste selbst zu betreiben. Gewünscht sind schnelle Iteration und eine relationale DB, die zur bestehenden Deck-/Karten-/Review-Domäne passt.

## Entscheidung

- Supabase als ein Backend-as-a-Service: managed Postgres, Auth, Row Level Security (RLS) und Storage.
- Alle Tabellen im Schema `public` haben RLS aktiv; Policies filtern pro `auth.uid()` auf eigene Zeilen (`apps/api/supabase/migrations/20260209230000_init.sql`).
- Server-Zugriff der API läuft über die **Service Role** und umgeht RLS bewusst; die App-Logik filtert dabei selbst nach `user_id` (`apps/api/src/lib/db.ts`, `supabase.ts`).
- Sensible Tabellen (`lp_transactions`, `rewards_claimed`) haben RLS ohne `anon`/`authenticated`-Policies, sind also nur über die Service Role erreichbar.
- Schema-Änderungen laufen als versionierte Migrationen (`apps/api/supabase/migrations/`).

## Konsequenzen

- Ein Anbieter deckt DB, Auth, RLS und Storage ab → weniger Betriebsaufwand, schnellere Iteration.
- Die Service Role umgeht RLS, daher muss jeder Server-Zugriff selbst nach `user_id` filtern; ein Fehler hebt die Sicherheitsgrenze auf.
- RLS-Policies und `SECURITY INVOKER`-Views müssen sorgfältig gepflegt werden; siehe `docs/runbooks/supabase-security-advisor.md` und `docs/runbooks/security-hardening.md`.
- Abhängigkeit von einem Anbieter (Lock-in), gemildert durch Standard-Postgres und portable SQL-Migrationen.
