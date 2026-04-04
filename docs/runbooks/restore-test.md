# Monthly Restore Test

## Ziel

Nachweis, dass Backup-/Restore-Pfade mindestens monatlich geprüft werden.

## Scope

- Supabase: Datenbank-Backup und Read-Pfad
- Vercel: Redeploy / Rollback eines funktionierenden Builds
- RevenueCat: Webhook-Signatur und Entitlement-Sync
- R2 / Upload-Signierung: Signed URL und Zugriffspfad
- KI-Provider-Ausfall: kontrollierter Fallback oder saubere Fehlermeldung

## Ausführung

```bash
./scripts/restore-smoke.sh
```

## Manuelle Prüfschritte

1. Smoke-Skript ausführen.
2. Letzten erfolgreichen Vercel-Deploy-Link notieren.
3. Supabase-Backup-/Restore-Pfad gegen die aktuelle Doku prüfen.
4. RevenueCat-Webhooks auf letzte erfolgreiche Events prüfen.
5. Einen Signed-Upload-Link erzeugen und Ablaufzeit kontrollieren.
6. Einen KI-Aufruf mit absichtlichem Fehlerpfad simulieren oder den dokumentierten Fallback prüfen.

## Abnahme

- Alle Prüfschritte sind dokumentiert.
- Es gibt für jeden Ausfallpfad einen klaren nächsten Schritt.
- Offene Abweichungen sind als Follow-up erfasst.

## Ergebnisdokumentation

- Zeitstempel des Laufes
- Name des Operators/Agents
- Ergebnis (pass/fail)
- Follow-up Aktion bei Fehler

## Vorlage

```md
Datum:
Operator:
Ergebnis:
Supabase:
Vercel:
RevenueCat:
R2:
KI-Fallback:
Follow-up:
```
