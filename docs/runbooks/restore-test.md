# Restore-Test

## Ziel

Nachweis, dass clearn nach einem Datenbank-Unfall wieder aufgebaut werden kann —
ehrlich getrennt danach, was eine Maschine beweisen kann und was ein Mensch
prüfen muss.

Bis #86 stand hier ein Skript, das nur nachgesehen hat, ob **eine Datei
existiert**, und danach „Simulated restore check passed" meldete. Eine grüne
Attrappe ist schlimmer als gar keine Prüfung: Sie erzeugt Vertrauen, das nicht
gedeckt ist, und niemand schaut noch einmal hin.

## Was automatisch geprüft wird

`scripts/restore-smoke.ts`, bei **jedem** CI-Lauf (`.github/workflows/ci.yml`):

1. Legt auf einem Wegwerf-Postgres eine frische, leere Datenbank an.
2. Spielt die Supabase-Stand-ins ein (`auth`, `storage`, `vault`, `cron`) — die
   Teile, die in Produktion die Plattform mitbringt, nicht unsere Dateien.
3. Wendet **alle** Migrationen aus `apps/api/supabase/migrations` der Reihe nach
   an. Schlägt eine fehl, wird die Probe rot und nennt die Datei.
4. Prüft, dass danach die tragenden Tabellen und Datenbank-Funktionen da sind und
   dass auf **jeder** eigenen Tabelle Row Level Security aktiv ist.
5. Löscht die Wegwerf-Datenbank wieder — auch wenn ein Schritt fehlschlägt.

Damit ist bewiesen: **Aus unseren Dateien lässt sich das Datenbank-Gerüst von
null wieder aufbauen.** Ohne diesen Nachweis wäre jede Sicherungskopie wertlos,
weil das Gerüst fehlt, in das sie zurückgespielt wird.

Die Produktions-Datenbank wird nicht angefasst — weder lesend noch schreibend,
und die Sicherungstabellen bleiben unberührt. Das Skript weigert sich, gegen eine
Supabase-Adresse zu laufen.

### Von Hand ausführen

```bash
docker run -d --name clearn-restore-smoke -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=clearn_test -p 55432:5432 postgres:16
```

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:55432/clearn_test pnpm run restore:smoke
```

`DATABASE_URL` muss auf einen Wegwerf-Server zeigen. **Niemals Produktion.**

## Was diese Probe NICHT beweist

Diese Punkte bleiben Handarbeit und brauchen Zugänge, die nur Andreas hat. Sie
stehen hier ausdrücklich als offen, damit niemand die grüne CI für einen
vollständigen Restore-Nachweis hält.

| Ausfallpfad                                    | Automatisch? | Warum nicht                                                              |
| ---------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| Gerüst aus Migrationen aufbauen                | ja           | —                                                                        |
| Echte Daten aus Supabase-Sicherung zurückholen | nein         | Braucht eine zweite Supabase-Datenbank (kostet Geld) oder Projekt-Zugang |
| Vercel-Rollback auf letzten guten Build        | nein         | Braucht Vercel-Zugang                                                    |
| RevenueCat-Webhooks und Entitlement-Sync       | nein         | Braucht RevenueCat-Zugang                                                |
| Signierte Bild-Links (R2 / Storage)            | nein         | Braucht Produktions-Schlüssel                                            |
| KI-Anbieter-Ausfall und Fallback               | nein         | Würde echtes KI-Guthaben verbrauchen                                     |

## Manuelle Prüfschritte (monatlich)

1. Restore-Probe von Hand laufen lassen (Befehl oben) oder den letzten grünen
   CI-Lauf notieren.
2. In Supabase nachsehen, dass Sicherungskopien existieren und wie alt die
   jüngste ist.
3. Letzten erfolgreichen Vercel-Deploy-Link notieren und den Rollback-Weg
   durchgehen.
4. RevenueCat-Webhooks auf zuletzt erfolgreiche Events prüfen.
5. Einen signierten Upload-Link erzeugen und die Ablaufzeit kontrollieren.
6. Den dokumentierten KI-Fallback prüfen.

## Abnahme

- Alle Prüfschritte sind dokumentiert.
- Es gibt für jeden Ausfallpfad einen klaren nächsten Schritt.
- Offene Abweichungen sind als Follow-up erfasst.

## Vorlage für die Ergebnisdokumentation

```md
Datum:
Operator:
Restore-Probe (automatisch): pass/fail, Anzahl Migrationen
Supabase-Sicherung vorhanden:
Vercel-Rollback-Weg geprüft:
RevenueCat:
R2 / signierte Links:
KI-Fallback:
Follow-up:
```
