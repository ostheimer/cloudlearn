# PR #758 – Integration und Qualitätsnachweise (03.11.2026)

Dieser Nachtrag enthält ausschließlich technische Repo-/Testnachweise.
Provider-Kontodaten und Betreiber-Finanzkonfiguration werden separat geführt.

## Problem und Scope

Parallele identische Scan-/Import-Jobs konnten mehrfach verarbeitet werden;
eine gemeinsame Zulassungsgrenze für Gemini-Aufrufe fehlte. Die Änderung
beansprucht Jobs atomar vor dem LP-Abzug und reserviert gemeinsame Kapazität
unmittelbar vor jedem Provideraufruf, einschließlich Chunks und Retries.
Unbekannte Versuche behalten ihre Reservierung; Speicherfehler sperren neue
Zulassungen. Gespeicherte Karten bleiben lernbar.

Budgetguard, Request-Claims, Migration, Tests und Runbook bilden zusammen eine
Zulassungsgrenze. Deshalb bleiben diese zusammengehörigen Teile in einem PR.
Keine unabhängigen Features, neuen Pakete oder reinen Formatierungsumbauten.

## Wirksamer Rot-Grün-Nachweis

Vorimplementierungsbasis / Merge-Base:
`6a896da8e23613475bd8da1159c63ce076c3ce15`.
Änderungsstand: `d32164c5116edfa9f32e259cc5d5098c30536e79`.

Historische Ausführung vor Implementierung:

- `pnpm --filter @clearn/api exec vitest run src/tests/geminiBudgetGuard.test.ts`
  → 6 fehlgeschlagene Fälle; unter anderem falsche Provider-Aufrufanzahl bei
  Chunk-/Retry-Budgeterschöpfung.
- `pnpm --filter @clearn/api exec vitest run src/tests/aiRequestConcurrency.test.ts`
  → 2 fehlgeschlagene Fälle; ein erwarteter gesperrter Request wurde als Erfolg
  aufgelöst. Die Fehler lagen im Verhalten, nicht in einer defekten Umgebung.
- Danach dieselben Tests zusammen mit `src/tests/geminiBudgetDb.integration.test.ts`
  und `src/tests/lpChargedIdempotentRequest.test.ts` → 21/21 bestanden.

Die historischen Ergebnisse wurden am 03.11.2026 im ursprünglichen Toolprotokoll
nachgelesen; kein neuer Gegenlauf und kein erfundener Rot-Nachweis. Später
hinzugefügte Fälle werden dadurch nicht rückwirkend als dieselbe Gegenprobe
bezeichnet. Die DB-Fälle sind zusätzlich durch echte lokale SQL-Integration geprüft.

## Integration mit Main

Getestete Main-Basis: `0e8da211d0c0e7c22eeb1aef75093d6f38c6e226`.
Lokaler kombinierter Code: `9d2613c53ae88aaa939b23745c968f13fa728fa6`.

Am 21.10.2026 mit eingefrorenem Lockfile, Node 24.21.0 und eigenem
PostgreSQL-16-Wegwerfcontainer, ausschließlich synthetische Daten:

- 60 fokussierte Tests, einschließlich 13 echter Postgres-Budget-/Claim-Fälle.
- `pnpm run ci`: 2.498 bestanden, 13 bestehende Umgebungsskips; alle Typechecks,
  ESLint 0 Fehler / 32 bestehende Warnungen.
- `pnpm run restore:smoke`: alle 63 Migrationen erfolgreich.
- Lokaler API-Produktionsbuild erfolgreich.
- Browser bei 1280×900 und 390×844: Abschaltmeldung sichtbar, Text erhalten,
  gespeicherte Karte weiterhin lernbar; keine Seitenfehler/externe Netzwerkziele.

Aktuelles Main `0adf2ee765b25de06118c04358fc776b7a919932` enthält gegenüber der
geprüften Basis nur PR-Vorlage und AGENTS-Qualitätsregeln, keinen neuen Produktcode.
Daher keine unbegründete lokale Volltestwiederholung. Die bisherigen Vercel-Status
vom Oktober sind kein neuer Remote-CI-Nachweis. Der GitHub-CI-Workflow ist am 03.11.2026 als `active` bestätigt.
Vor Merge ist genau ein vollständiger CI-Lauf am endgültigen integrierten Head
einschließlich SQL-/Restore-/Build-/Smoke-Gates erforderlich; die endgültige
Run-URL und das Ergebnis werden im bestehenden PR nachgetragen.

## Existenz und Kompatibilität

- Neue lokale Exporte/Imports und ihre Parameter-/Rückgabeformen im Repository
  geprüft: Budget-, Claim- und Identity-Helfer sowie vorhandene LP-/Refund-/HTTP-
  und Supabase-Helfer. Aliase passen zu `apps/api/tsconfig.json`.
- Keine neuen externen Pakete; Manifeste und Lockfile werden durch #758 selbst
  gegenüber seiner Merge-Base nicht geändert.
- Installierte und gelockte `@supabase/supabase-js` 2.95.3:
  `SupabaseClient.rpc(fn,args,options)` in der tatsächlichen Paketquelle geprüft;
  benannte Argumente und JSON-/boolesche Rückgaben passen zu allen fünf SQL-RPCs.
  Quelle: https://supabase.com/docs/reference/javascript/rpc
- Node-Builtins `createHash`/`randomUUID` existieren in der verwendeten Runtime.
  Quelle: https://nodejs.org/docs/latest-v24.x/api/crypto.html
- Gemini-Endpoint und UsageMetadata sind durch offizielle API-Dokumentation
  belegt: https://aistudio.google.com/api-reference/generate-content
  Reale Provider-Funktion, Quoten und Billing sind dadurch nicht live abgenommen.

## Releasegrenze

Migration zuerst; neue Tabellen starten deaktiviert. Ein unkoordinierter
API-Rollout würde neue KI-Erstellung sperren. Der Schlüsselwechsel darf erst
nach Auslieferung und Identifikation eines guardfähigen API-Stands erfolgen;
ältere API-Deployments und ihre direkten URLs sind vor Aktivierung zu prüfen
und vom produktiven Aufrufpfad auszuschließen. Niemals ein ungeguardetes altes
Deployment mit neuem Schlüssel redeployen. Rollback nur auf einen identifizierten
guardfähigen Stand; bei Zweifel KI-Zulassung deaktiviert lassen und Journal
beziehungsweise Claims nicht löschen.

Kein echter KI-Aufruf, EAS-Build oder Produktionszugriff durch diese Prüfung.
Dieser Nachtrag ändert keine Programmlogik oder Runtime-Konfiguration und ist
nirgends Programmeingabe. Doku-Ausnahme: Text, Quellen und Konsistenz geprüft;
kein künstlicher roter Dokumentationstest.
