# Release Gates

## Ziel

Kein Merge auf `main`, solange ein Shipping-Kanal oder ein technischer Qualitäts-Gate rot ist.

## Verbindliche Gates

### CI

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:cloudlearn-smoke`

### Deployments

- Vercel `clearn-api`
- Vercel `clearn-web`
- Vercel `cloudlearn`

## Merge-Kriterium

Ein PR ist nur releasefähig, wenn alle vier CI-Gates und alle drei Vercel-Deployments grün sind.

## Smoke-Umfang für `cloudlearn`

- Root-Load ohne Session funktioniert.
- Auth-Screen ist auf Desktop sichtbar.
- Auth-Screen ist auf Mobile sichtbar.
- Kein Bootstrap-Fehler in der Browser-Konsole.
- Enter im Login-Formular löst denselben Submit-Pfad wie der Button aus.

## Manuelle Kurzprüfung vor Merge

1. Preview-Link öffnen.
2. Desktop-Breite prüfen.
3. Mobile-Breite prüfen.
4. Auth-Screen sichtbar?
5. Konsole sauber?
6. Keine Redirect-Schleife?

## Wenn ein Gate rot ist

- `CI rot`: Fehler im Repo beheben, nicht in Vercel „wegklicken“.
- `cloudlearn rot`: Mobile-Web-Preview als Blocker behandeln.
- `clearn-api rot`: kein Merge, auch wenn `cloudlearn` grün ist.
- `clearn-web rot`: kein Merge, auch wenn Mobile-Preview grün ist.

## Ownership

- PR-Autor: behebt rote Gates vor Merge.
- Reviewer: prüft, dass die Gates wirklich grün sind und nicht nur „neutral“.
- Operator on call: entscheidet nur bei externer Störung über temporäre Ausnahmen.
