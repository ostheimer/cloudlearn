# Live E2E in CI (Issue #85, Teil 3)

Der Workflow [`.github/workflows/e2e-live.yml`](../../.github/workflows/e2e-live.yml)
lässt die Live-End-to-End-Suite (`playwright.config.ts`) gegen die produktiven
Vercel-Deployments laufen:

- Web: https://clearn-web.vercel.app
- API: https://clearn-api.vercel.app

Er läuft **täglich um 05:00 UTC** und zusätzlich per Hand über den
**„Run workflow"**-Knopf im Actions-Tab. Er ist von `ci.yml` getrennt und
blockiert normale Pull Requests nicht.

## Einmalige Einrichtung (nur Andreas)

Die Tests melden sich mit dem Test-Konto `apitest@clearn.test` an. Bis die
Zugangsdaten als Secrets hinterlegt sind, **überspringt** der Workflow die
Prüfung freundlich (grün mit Hinweis) statt rot zu scheitern.

Zum Scharfschalten in GitHub anlegen unter
**Settings → Secrets and variables → Actions → New repository secret**:

| Secret               | Inhalt                                             |
| -------------------- | -------------------------------------------------- |
| `TEST_USER_PASSWORD` | Passwort von `apitest@clearn.test` (aus `.env.local`) |
| `TEST_USER_EMAIL`    | `apitest@clearn.test`                              |
| `SUPABASE_URL`       | Projekt-URL von Supabase (`clearn`)               |
| `SUPABASE_ANON_KEY`  | Öffentlicher Anon-Key von Supabase (`clearn`)     |

Sobald mindestens `TEST_USER_PASSWORD` gesetzt ist, läuft die Suite beim
nächsten Zeitplan-Lauf (oder sofort per „Run workflow") echt durch.

## Wichtig

- **Das Passwort niemals** in eine Datei, einen Commit oder ein Log schreiben —
  ausschließlich als GitHub-Secret. Die Tests lesen alle Werte aus der Umgebung
  (`e2e/helpers.ts`), Secrets werden in Logs automatisch maskiert.
- `TEST_USER_EMAIL`, `SUPABASE_URL` und `SUPABASE_ANON_KEY` sind nicht geheim,
  werden der Einheitlichkeit halber aber ebenfalls als Secrets geführt.

## Zum Ansehen der Ergebnisse

Nach jedem echten Lauf liegt unter dem Workflow-Run das Artefakt
`playwright-report` (HTML-Bericht, 7 Tage aufbewahrt).
