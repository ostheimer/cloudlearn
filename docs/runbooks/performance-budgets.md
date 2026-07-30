# Performance Budgets

## Was echt gemessen wird

`scripts/perf-smoke.ts --http` schickt richtige HTTP-Anfragen an das Deployment,
mehrfach hintereinander, und vergleicht das 95er-Perzentil („95 von 100 Anfragen
waren schneller als …") mit den Budgets. Die ersten Anfragen wärmen den Server
auf und werden verworfen, sonst misst man einmal Kaltstart statt Alltag.

Der Lauf fragt **ausschliesslich lesend** ab: keine Schreibvorgänge, keine
KI-Aufrufe, keine Kosten.

| Abfrage                       | Endpunkt                        | Budget P95 | gemessen 2026-07-30 |
| ----------------------------- | ------------------------------- | ---------- | ------------------- |
| Lebenszeichen der API         | `GET /api/health`               | 1500 ms    | 136 ms              |
| Bibliothek laden              | `GET /api/v1/decks`             | 2500 ms    | 791 ms              |
| Lernen starten                | `GET /api/v1/learn/due`         | 2500 ms    | 244 ms              |
| Fällig-Zahlen je Kartenkasten | `GET /api/v1/stats/due-by-deck` | 2500 ms    | 608 ms              |

Zusätzlich: Fehlerquote je Endpunkt < 1 %.

Die Budgets sind am 2026-07-30 gegen `clearn-api.vercel.app` kalibriert und
absichtlich mit Luft versehen (rund das Doppelte bis Dreifache des schlechtesten
beobachteten Werts). Die Probe soll echte Verschlechterungen finden, nicht bei
jedem Netz-Zucken rot werden. Wenn die Werte dauerhaft deutlich sinken, dürfen
die Budgets nachgezogen werden — dann aber mit neuer Messreihe und Datum in
dieser Tabelle.

### Ausführen

```bash
pnpm run perf:http
```

Braucht `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_USER_EMAIL` und
`TEST_USER_PASSWORD` in der Umgebung (siehe `.env.example`). Ohne Zugangsdaten
misst `pnpm run perf:http --public-only` nur den öffentlichen Endpunkt.

In GitHub: Actions → **Perf HTTP** → „Run workflow". Bewusst nur auf Knopfdruck,
nicht bei jedem Pull Request und nicht nach Zeitplan — Messungen gegen das
Internet schwanken, und die tägliche Live-E2E-Suite (#85) soll nicht gedoppelt
werden.

## Was NICHT automatisch gemessen wird

Zwei ältere Zielwerte lassen sich nicht ohne Nebenwirkung messen. Sie gelten
weiterhin, werden aber nur von Hand geprüft:

| Zielwert                                     | Warum nicht automatisch                                        |
| -------------------------------------------- | -------------------------------------------------------------- |
| P95 `POST /api/v1/scan/process` < 8 s        | Jeder Lauf löst einen echten KI-Aufruf aus und kostet Guthaben |
| P95 `POST /api/v1/cards/:id/review` < 400 ms | Jeder Lauf schreibt Zeilen in die Produktions-Datenbank        |

Beides ist nachrüstbar, sobald es ausdrücklich gewünscht ist: für den Scan mit
einem Kosten-Hinweis vor dem Lauf, für das Bewerten mit dem Test-Konto
`apitest@clearn.test`, dessen Zeilen nie zu echten Nutzerdaten gehören.

## Die schnelle Nebenprüfung

`pnpm run perf:smoke` (ohne `--http`) misst Programmteile im Arbeitsspeicher —
ohne Netz, ohne Datenbank. Das ist eine Plausibilitätsprüfung für den
Orchestrator, **kein** Nachweis, dass die veröffentlichte App schnell ist. Genau
diese Verwechslung war der Befund in #86.

## Maßnahmen bei Regression

1. Idempotency-Hits prüfen (unnötige Re-Generierung vermeiden).
2. Input-Größen validieren und begrenzen.
3. Fallback-Modelle nur bei Fehlern verwenden.
4. `X-Vercel-Id` prüfen: läuft die Anfrage wirklich in der Region Dublin (#491)?
5. Hotspots via Profiling lokalisieren und in ADR dokumentieren.
6. Bei deutlicher Regression (> 20 %) Incident-Review anstoßen.
