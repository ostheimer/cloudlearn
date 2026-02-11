# Autonomous Delivery Loop

## Ziel

Automatisierter Agent-Workflow für Verifikation, Deployment und Status-Polling.

## Ablauf

1. Branch vorbereiten und Ticket-Änderungen einspielen.
   - Optional: `./scripts/agent-ticket.sh <agent-name> <ticket-id>`
2. `./scripts/orchestrator.sh verify`
3. `./scripts/orchestrator.sh deploy`
4. Deployment-URL aus Vercel-Ausgabe übernehmen.
5. `./scripts/orchestrator.sh poll <deployment-url>`

## Merge-Regeln

- Kein Merge bei roten Gates (Lint/Typecheck/Test/Perf).
- Kein Merge bei `ERROR`/`CANCELED` Deploy-Status.
- Bei Failure: Ticket in `blocked` markieren und Ursache dokumentieren.
- Rebase/Merge nur auf aktuellen `main` Stand.

## Vercel-Hinweis

Wenn das Projekt auf Vercel läuft, muss nach jedem Commit/Push der Deploy-Status bis `READY` oder `ERROR` überwacht werden.
