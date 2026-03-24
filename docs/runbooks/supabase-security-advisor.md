# Supabase: Security Advisor (RLS & Views)

Kurzanleitung, wenn der **Security Advisor** oder E-Mail-Benachrichtigungen von Supabase auf Probleme wie `rls_disabled_in_public` oder `Security Definer View` hinweisen.

## Kontext

- Tabellen im Schema `public` sind über **PostgREST** (Supabase Data API) grundsätzlich erreichbar, sofern die API-Keys und Grants es zulassen.
- **Row Level Security (RLS)** muss für solche Tabellen aktiviert sein; sonst meldet der Linter `rls_disabled_in_public`.
- Views mit **SECURITY DEFINER** laufen mit Rechten des View-Owners und können **RLS unterlaufen** — der Advisor empfiehlt stattdessen **SECURITY INVOKER** (`security_invoker = true` in PostgreSQL 15+).

## Projekt clearn — umgesetzte Maßnahmen

Migration: `apps/api/supabase/migrations/20260324120000_security_advisor_rls_leaderboard.sql`

| Objekt | Maßnahme |
|--------|----------|
| `public.lp_transactions` | `ENABLE ROW LEVEL SECURITY`, keine Policies für `anon`/`authenticated` → direkter Client-Zugriff gesperrt; **Service Role** (API) umgeht RLS weiterhin. |
| `public.rewards_claimed` | wie oben |
| `public.leaderboard_public` | View neu mit `WITH (security_invoker = true)` — gleiche Spalten wie zuvor; Leaderboard-API nutzt weiterhin `profiles` per Service Role. |

## Einspielen (Production)

Im Repo-Root bzw. `apps/api` (je nach Setup):

```bash
cd apps/api
supabase link --project-ref <REF>
supabase db push
```

Danach im Dashboard unter **Advisors → Security Advisor** auf **Rerun linter** klicken und prüfen, ob die drei Einträge verschwinden.

## Manuelle Verifikation (optional)

- Sicherstellen, dass LP- und Referral-Endpunkte nach dem Push weiter funktionieren (lesen/schreiben über die API mit Service Role).
- Wenn ihr später **direkten** Supabase-Client-Zugriff auf `lp_transactions` braucht, gezielt `CREATE POLICY` für `authenticated` ergänzen (z. B. nur eigene Zeilen per `auth.uid() = user_id`).
