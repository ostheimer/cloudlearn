# Performance Budgets

## Zielwerte

- P95 `POST /api/v1/scan/process` < 8s
- P95 `POST /api/v1/cards/:id/review` < 400ms
- Fehlerquote 5xx < 1%

## Prüfungen

- `pnpm run perf:smoke` pro Branch mindestens 1x ausführen.
- Bei deutlicher Regression (>20%) Incident-Review anstoßen.

## Maßnahmen bei Regression

1. Idempotency-Hits prüfen (unnötige Re-Generierung vermeiden).
2. Input-Größen validieren und begrenzen.
3. Fallback-Modelle nur bei Fehlern verwenden.
4. Hotspots via Profiling lokalisieren und in ADR dokumentieren.
