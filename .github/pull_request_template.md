## Release Gates

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:cloudlearn-smoke`
- [ ] Vercel `clearn-api` ist grün
- [ ] Vercel `clearn-web` ist grün
- [ ] Vercel `cloudlearn` ist grün

## Produktprüfung

- [ ] Auth-Screen rendert auf Desktop und Mobile korrekt
- [ ] Keine unnötigen auth-pflichtigen Requests vor Login
- [ ] Preview-Link wurde geöffnet und kurz geprüft

## Risiko / Rollout

- [ ] Restore-/Rollback-Auswirkung geprüft
- [ ] Externe Setups angepasst, falls nötig:
  RevenueCat / Vercel / Supabase / OAuth / App-Store-Assets

## Kontext

Kurze Zusammenfassung der Änderung und des verbleibenden Risikos.
