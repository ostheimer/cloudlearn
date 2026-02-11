# Incident Response Runbook

## Ziele

- Ausfall schnell erkennen und eingrenzen.
- Nutzerimpact minimieren.
- Nachbearbeitung mit klaren Maßnahmen.

## Trigger

- API-Fehlerquote > 1%.
- P95 `scan/process` > 8 Sekunden.
- Ausfall eines KI-Providers oder Supabase.

## Ablauf

1. Incident deklarieren und Severity festlegen.
2. Kommunikationskanal eröffnen, Incident Lead benennen.
3. Telemetrie prüfen (`request_id`, Error Logs, Sentry).
4. Mitigation durchführen (Fallback aktivieren, Rollback, Rate-Limit verschärfen).
5. Status alle 15 Minuten aktualisieren.
6. Incident schließen und Postmortem erstellen.

## Postmortem Pflichtfelder

- Root Cause
- Time to Detect
- Time to Mitigate
- User Impact
- Konkrete Follow-ups mit Owner und Deadline
